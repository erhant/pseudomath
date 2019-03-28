const colors = require('colors');
const _ = require('lodash');
const Enums = require('./Enums');
const Constants = require('./Constants');
const Utils = require('./Utilities');
const mathLineTypes = Enums.mathLineTypes;

let V = '';
let I = '';
let frontend_symbols = {};

module.exports = {

    setVariableSet(variables) {
        let vars = [];
        _.each(variables, variable => {
            if (!variable.isFunction) {
                vars.push(variable.text);
            }
        });
        V = vars.join(',');
    },

    setInputSet(inputs) {
        let ins = [];
        _.each(inputs, input => {
            ins.push(input);
        });
        I = ins.join(',');
    },

    setSymbols(symbols) {
        // Check if symbol table is ok
        _.each(symbols, symbol => {
            if (symbol.hasOwnProperty('isArray') && symbol.hasOwnProperty('isDimension')) {
                let err = new Error('A variable cannot be a dimension and array!');
                err.type = 'Symbols';
                err.content = {
                    culprit: symbol
                };
                throw err;
            }
        });
        frontend_symbols = symbols;
        console.log('Symbol Table:'.yellow+'\n'+JSON.stringify(symbols, null, 3));
    },

    getVariableSet() {
        return V.split(',')
    },

    initialLine(name, jump) {
        let arrI = I.split(',');
        // Array notation check for initial line
        _.each(arrI, (x, i) => {
            if (x.includes('[')) {
                // Is an array
                let arrName = x.substring(0, x.indexOf('['));
                arrI[i] = arrName;
                _.each(frontend_symbols[arrName].dimensions, d => {
                    if (/[a-zA-Z][a-zA-Z0-9]*/.test(d)) {
                        arrI.push(d);
                    }
                })
            }
        }); // A[N]
        let arrV = V.split(','); // A, N
        let arrV_without_I = _.filter(arrV, v => !_.includes(arrI, v)); // members of V not belonging to I
        let VV = V;
        _.each(arrV_without_I, v => {
            Utils.variableReplacer(VV, v, '\\infty');
        });
        return {
            left: {
                name: name,
                id: 1,
                params: Utils.parameterSplitter(I),
                type: mathLineTypes.INITIAL
            },
            right: {
                name: 'L',
                id: jump,
                params: Utils.parameterSplitter(VV),
                type: mathLineTypes.SEQUENCE
            },
            string: `${name}(${Utils.parameterSplitter(I)}) = L_{${jump}}(${Utils.parameterSplitter(VV)})`
        }
    },

    directLine(id, jump) {
        return {
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            right: {
                name: 'L',
                id: jump,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = L_{${jump}}(${Utils.parameterSplitter(V)})`
        };
    },

    assignLine(id, jump, lhs, rhs) {
        let VV = Utils.assignProcessor(V, lhs, rhs, frontend_symbols);
        return {
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            right: {
                name: 'L',
                id: jump,
                params: Utils.parameterSplitter(VV),
                type: mathLineTypes.SEQUENCE
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = L_{${jump}}(${Utils.parameterSplitter(VV)})`
        };
    },

    forAssignLine(id, for_id, lhs, rhs) {
        let VV = Utils.assignProcessor(V, lhs, rhs, frontend_symbols);
        return {
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            right: {
                name: 'F',
                id: for_id,
                params: Utils.parameterSplitter(VV),
                type: mathLineTypes.LOOP
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = F_{${for_id}}(${Utils.parameterSplitter(VV)})`
        };
    },

    returnLine(id, returns) {
        if (returns === 'true') {
            returns = '1';
        } else if (returns === 'false') {
            returns = '0';
        }
        return {
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.FINAL
            },
            right: {
                returns: Utils.tryEval(returns)
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = ${returns}`
        };
    },

    // Do-While and While are all same, only their jump lines are different
    whileLine(id, whileId, jumpTrue, jumpFalse, cond) {
        let condObj = Utils.conditionProcessor(cond, jumpTrue, jumpFalse, V);
        return [{
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            right: {
                name: 'W',
                id: whileId,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.LOOP
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = W_{${whileId}}(${Utils.parameterSplitter(V)})`
        },
            {
                left: {
                    name: 'W',
                    id: whileId,
                    params: Utils.parameterSplitter(V),
                    type: mathLineTypes.LOOP
                },
                right: condObj,
                string: `W_{${whileId}}(${Utils.parameterSplitter(V)}) = ${condObj.string}`
            }];
    },

    forLine(id, for_id, jumpTrue, jumpFalse, cond, initial) {
        let condObj = Utils.conditionProcessor(cond, jumpTrue, jumpFalse, V);
        let [initial_lhs, initial_rhs] = initial.split('=').map(x => x.trim());
        let initialStr = Utils.assignProcessor(V, initial_lhs, initial_rhs, frontend_symbols);
        return [{
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            right: {
                name: 'F',
                id: for_id,
                params: Utils.parameterSplitter(initialStr),
                type: mathLineTypes.LOOP
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = F_{${for_id}}(${Utils.parameterSplitter(initialStr)})`
        },
            {
                left: {
                    name: 'F',
                    id: for_id,
                    params: Utils.parameterSplitter(V),
                    type: mathLineTypes.LOOP
                },
                right: condObj,
                string: `F_{${for_id}}(${Utils.parameterSplitter(V)}) = ${condObj.string}`
            }];
    },

    ifLine(id, jumpTrue, jumpFalse, cond) {
        let condObj = Utils.conditionProcessor(cond, jumpTrue, jumpFalse, V);
        return {
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.SEQUENCE
            },
            right: condObj,
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = ${condObj.string}`
        };
    },

    program_end(id) {
        return {
            left: {
                name: 'L',
                id: id,
                params: Utils.parameterSplitter(V),
                type: mathLineTypes.FINAL
            },
            right: {
                returns: '\\infty'
            },
            string: `L_{${id}}(${Utils.parameterSplitter(V)}) = \\infty`
        };
    }
};