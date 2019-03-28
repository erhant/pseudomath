const Constants = require('./Constants');
const Parser = require('expr-eval').Parser;
const _ = require('lodash');

function arrayWrite(arrayName, to, value, dimensions) {
    return ` |${arrayName} + \\delta_{${dimensions}}(${to.split(',').join(Constants.dimensionCommaPlaceholder)})(${value} - ${arrayRead(arrayName, to)})| `;
}

function arrayRead(arrayName, from) {
    return `${arrayName}_{${from.split(',').join(Constants.dimensionCommaPlaceholder)}}`;
}

function variableReplacer(string, variableName, expr) {
    if (variableName.includes('[')) {
        // different behaviour for array operations
        string = string.replace(variableName, expr);
    } else {
        string = ` ${string} `;
        let pattern = `[^a-zA-Z0-9]${variableName}[^a-zA-Z0-9]`;
        let arr = string.match(new RegExp(pattern, 'g'));
        _.each(arr, a => {
            string = string.replace(a, a.replace(variableName, expr));
        });
        string = string.substring(1, string.length-1);
    }
    return string;
}

function tryEval(expr) {
    let result;
    try {
        // parse if you can
        result = Parser.evaluate(expr)
    } catch (err) {
        // dont do anything if you cant
        result = expr;
    }
    return result+'';
}

function parameterSplitter(params) {
        // Incomes string such as a,b,c or a,pow(2,3),c or anything
        let functionsWithComma = params.match(/(pow|div|root)\([^,]+,/ig); // regex for "function(something,"
        _.each(functionsWithComma, func => {
            params = params.replace(func,func.substring(0, func.length-1) + Constants.parameterCommaPlaceholder);
        });
        params = params.split(',');
        return params;
    }

function assignProcessor(V, lhs, rhs, frontend_symbols) {
        // Find all array operations at the right side
        let rhs_arrayOps = rhs.match(/[^[^\]^ .]*\[[^[^\].]*]/g);
        if (rhs_arrayOps) {
            let rhs_arrayOps_composite = [];
            let tmp = rhs_arrayOps[0];
            _.each(rhs_arrayOps.splice(1), op => {
                if (op.charAt(0) !== '[') {
                    rhs_arrayOps_composite.push(tmp);
                    tmp = '';
                }
                tmp += op;
            });
            rhs_arrayOps_composite.push(tmp);
            // Now we have all operations, convert them to their mathematical representations
            let mathematical_rhs_arrays = [];
            _.each(rhs_arrayOps_composite, op => {
                let idx = op.indexOf('[');
                let arrayName = op.substring(0, idx);
                let froms = op.replace(arrayName, '').replace(/[[\]]/g, ',').replace(/,+/g, ',');
                froms = froms.substring(1,froms.length-1);
                mathematical_rhs_arrays.push(arrayRead(arrayName, froms));
            });
            _.each(rhs_arrayOps_composite, (op, idx) => {
                rhs = variableReplacer(rhs, op, mathematical_rhs_arrays[idx]);
            });
        }
        // Find if there is an array operation to the left
        let lhs_arrayOps = lhs.match(/[^[^\]^ .]*\[[^[^\].]*]/g);
        let lhs_arrayOps_composite = '';
        if (lhs_arrayOps) {
            let tmp = lhs_arrayOps[0];
            _.each(lhs_arrayOps.splice(1), op => {
                tmp += op;
            });
            lhs_arrayOps_composite = tmp;
        }
        if (lhs_arrayOps_composite !== '') {
            // Array write operation
            // replace lhs with arrayName
            // replace rhs with array write operation
            let idx = lhs_arrayOps_composite.indexOf('[');
            let arrayName = lhs_arrayOps_composite.substring(0, idx);
            let to = lhs_arrayOps_composite.replace(arrayName, '').replace(/[[\]]/g, ',').replace(/,+/g, ',');
            to = to.substring(1,to.length-1); // this is the position to be written
            let value = rhs;
            if (!frontend_symbols[arrayName].hasOwnProperty('dimensions')) {
                let err = new Error('Array-like usage of a non-array variable!');
                err.type = 'Array Usage';
                err.content = {
                    culprit: frontend_symbols[arrayName]
                };
                throw err;
            }
            let dimensions = frontend_symbols[arrayName].dimensions.join(' \\times ');
            V = variableReplacer(V, arrayName, arrayWrite(arrayName, to, value, dimensions));
        } else {
            // Normal assign operation
            V = variableReplacer(V, lhs, rhs);
        }
        return V;
    }

function conditionProcessor(condStr, jumpTrue, jumpFalse, V) {
        let cond_arrayOps = condStr.match(/[^[^\]^ .]*\[[^[^\].]*]/g);
        if (cond_arrayOps) {
            let cond_arrayOps_composite = [];
            let tmp = cond_arrayOps[0];
            _.each(cond_arrayOps.splice(1), op => {
                if (op.charAt(0) !== '[') {
                    cond_arrayOps_composite.push(tmp);
                    tmp = '';
                }
                tmp += op;
            });
            cond_arrayOps_composite.push(tmp);
            // Now we have all operations, convert them to their mathematical representations
            let mathematical_cond_arrays = [];
            _.each(cond_arrayOps_composite, op => {
                let idx = op.indexOf('[');
                let arrayName = op.substring(0, idx);
                let froms = op.replace(arrayName, '').replace(/[[\]]/g, ',').replace(/,+/g, ',');
                froms = froms.substring(1,froms.length-1);
                mathematical_cond_arrays.push(arrayRead(arrayName, froms));
            });
            _.each(cond_arrayOps_composite, (op, idx) => {
                condStr = condStr.replace(op, mathematical_cond_arrays[idx]);
            });
        }
        return {
            name: '\\Delta',
            condition: condStr,
            onTrue: {
                name: 'L',
                id: jumpTrue,
                params: parameterSplitter(V)
            },
            onFalse: {
                name: 'L',
                id: jumpFalse,
                params: parameterSplitter(V)
            },
            string: `\\Delta_{${condStr}}(L_{${jumpTrue}}(${V}),L_{${jumpFalse}}(${V}))`
        };
    }

    // Check if the object is {} (empty)
function isEmpty(obj) {
    for(let key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

    // Replaces semicolons in the for-loop line with a placeholder so that they dont get effected
function forLoopSemicolonSolver(code) {
    let forLoops = code.match(/for\s*\(.+;.+;.+\)/ig);
    _.each(forLoops, body => {
        let newBody = body.replace(/;/g, Constants.semiColonPlaceHolder);
        code = code.replace(body, newBody);
    });
    return code;
}

    // Replaces semicolons to their placeholders
function forLoopSemicolonResolver(code) {
    let forLoopRegex = new RegExp(`for\\s*(.+${Constants.semiColonPlaceHolder}.+${Constants.semiColonPlaceHolder}.+)`, 'ig');
    let placeholderRegex = new RegExp(`${Constants.semiColonPlaceHolder}`, 'ig');
    let forLoops = code.match(forLoopRegex);
    _.each(forLoops, body => {
        let newBody = body.replace(placeholderRegex, ';');
        code = code.replace(body, newBody.trim());
    });
    return code;
}

module.exports = {
    forLoopSemicolonResolver: forLoopSemicolonResolver,
    forLoopSemicolonSolver: forLoopSemicolonSolver,
    isEmpty: isEmpty,
    conditionProcessor: conditionProcessor,
    assignProcessor: assignProcessor,
    parameterSplitter: parameterSplitter,
    tryEval: tryEval,
    variableReplacer: variableReplacer
};
