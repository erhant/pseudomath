const Jison = require('jison');
const colors = require('colors');
const Evaluator = require('./SourceCodeEvaluator');
const Utils = require('./Utilities');
const _ = require('lodash');
const Mathematical = require('./Mathematical');
const Exporter = require('./Exporter');
const Constants = require('./Constants');
const Enums = require('./Enums');
const fs = require('fs');
const lineTypes = Enums.lineTypes;
const mathLineTypes = Enums.mathLineTypes;
let symbols = {};

module.exports = {

    process(code) {
        // Numbers (this is a better regex with things like 3e+6
        // lexer.addRule(/-?\d+(?:\.\d+)?(?:e[+\-]?\d+)?/i, lexeme => {
        //     return 'NUMBER' // literal number
        // });
        let parser = new Jison.Parser(fs.readFileSync("pseudomath.jison", "utf8"));
        let parsingResult = parser.parse(code);
        if (parsingResult === true) {
            // The input code has valid syntax
            // We will remove their newlines and put our own
            code = Utils.forLoopSemicolonSolver(code); // we should put a placeholder for semicolons in a for loop
            code = code.replace(/\s+|\t+|\r\n|\n/g, ' ').replace(/{/g, '\n{\n').replace(/;/g, ';\n').replace(/}/g, '}\n'); // we place our own newlines to work line by line
            code = Utils.forLoopSemicolonResolver(code); // we should now place actual semicolons in the for loop
            Exporter.setInputCode(code);

            let lines = code.split('\n'); // Split by newlines
            lines = _.filter(lines, line => line !== ''); // delete empty lines
            let lineObjects = processLines(lines);
            lineObjects = processLineObjects(lineObjects);
            let mathObjects = convertLineObjectsToMathObjects(lineObjects);
            Exporter.setConvertedLineNotation(mathObjects);

            mathObjects = squishMathObjects(mathObjects);
            // todo: expression evaluation for a simpler look
            Exporter.setSquishedLineNotation(mathObjects);
            Exporter.setSetofFunctions(mathObjects);
            Exporter.set4Tuple();
            // This will prepare the JavaScript code of the squished functions
            let squishedCode = Evaluator.convertToCode(mathObjects);
            Exporter.setConvertedCode(squishedCode);
        }
    }
};

// Classify lines, give them labels, tokenize their content
function processLines(lines) {
    lines = lines.map(line => line.trim());
    console.log('LINES:'.red);
    _.each(lines, (line, idx) => {
        console.log((idx+1).toString().green+'\t'+line);
    });
    let program_call_line = lines[0];
    let lineObj = {
        type: '',
        id: '',
        content: {}
    };
    let lineObjects = [];
    let lineId = 1;
    let while_id = 1;
    let for_id = 1;
    // Process inital call line
    lineObj.type = lineTypes.INITIAL;
    lineObj.content.functionName = program_call_line.match(/^.*\(/)[0].replace(/\(/, '');
    lineObj.content.inputs = program_call_line.match(/\(.*\)/)[0].replace(/[() ]/g, '').split(',');
    // Update symbol table with the dimension variable
    _.each(lineObj.content.inputs, input => {
        if (input.includes('[')) {
            input = input.replace(/[[\]]+/g, Constants.dimensionCommaPlaceholder).split(Constants.dimensionCommaPlaceholder).map(x => x.trim()).filter(x => x !== '');
            let arrName = input[0];
            if (symbols.hasOwnProperty(arrName)) {
                symbols[arrName].isArray = true;
                symbols[arrName].dimensions = [];
            }
            input = input.slice(1);
            _.each(input, dim => {
                if (symbols.hasOwnProperty(dim)) {
                    symbols[dim].isDimension = true;
                    if (symbols[dim].hasOwnProperty('ofArray')) {
                        symbols[dim]['ofArray'].push(arrName);
                    } else {
                        symbols[dim]['ofArray'] = [arrName];
                    }
                }
                symbols[arrName].dimensions.push(dim);
            })
        }
    });
    lineObj.id = lineId++;
    lineObjects.push(lineObj);
    // Process rest of the lines
    lines = lines.slice(1);
    _.each(lines, line => {
        lineObj = {
            type: '',
            id: '',
            content: {}
        };
        if (/^for[( ]/i.test(line)) {
            lineObj.type = lineTypes.FOR;
            lineObj.content.for_id = for_id++;
            lineObj.id = lineId++;
            let operations = line.match(/[(;].*[;)]/ig)[0];
            operations = operations.substring(1,operations.length-1).split(';').map(op => op.trim());
            lineObj.content.initial = operations[0]; // first operation
            lineObj.content.cond = operations[1]; // second operation
            lineObj.content.update = operations[2]; // third operation
        } else if (/^if[( ]/i.test(line)) {
            // IF line
            lineObj.type = lineTypes.IF;
            let cond = line.match(/\(.*\)/)[0];
            cond = cond.substring(1, cond.length - 1); // remove parentheses
            lineObj.content.cond = cond.trim();
            lineObj.id = lineId++;
        } else if (/^else/i.test(line)) {
            // ELSE line
            lineObj.type = lineTypes.ELSE;
            lineObj.id = lineId++;
        }  else if (/^return .*/i.test(line)) {
            // Return line
            lineObj.type = lineTypes.RETURN;
            lineObj.content.returns = line.match(/ .*;$/)[0].trim().replace(/;/,'');
            lineObj.id = lineId++;
        } else if (/^while *\(/i.test(line) && line.includes(';')) {
            lineObj.type = lineTypes.DW_WHILE;
            let cond = line.match(/\(.*\)/)[0];
            cond = cond.substring(1, cond.length - 1); // remove parentheses
            lineObj.content.cond = cond.trim();
            lineObj.id = lineId++;
            lineObj.content.while_id = while_id++;
        } else if (/^while/i.test(line)) {
            // WHILE line of a WHILE loop
            lineObj.type = lineTypes.W_WHILE;
            let cond = line.match(/\(.*\)/)[0];
            cond = cond.substring(1, cond.length - 1); // remove parentheses
            lineObj.content.cond = cond.trim();
            lineObj.id = lineId++;
            lineObj.content.while_id = while_id++;
        } else if (/^do/i.test(line)) {
            lineObj.type = lineTypes.DO;
            lineObj.id = lineId++;
        } else if (line.includes('=') && line.includes(';')) {
            // Line
            lineObj.type = lineTypes.ASSIGN;
            lineObj.content.leftHandSide = line.match(/^.*=/)[0].replace(/=/,'').trim().replace(/;/,'');
            lineObj.content.rightHandSide = line.match(/=.*;$/)[0].replace(/=/,'').trim().replace(/;/,'');
            lineObj.id = lineId++;
        } else if (/^}$/.test(line)) {
            // Right bracket line, closes a block
            lineObj.type = lineTypes.RBRACE;
            lineObj.id = lineId++;
        } else if (/^{$/.test(line)) {
            // Left bracket line, opens a block
            lineObj.type = lineTypes.LBRACE;
            lineObj.id = lineId++;
        }
        lineObjects.push(lineObj);
    });

    // console.log('\nProcessing lines Phase 1'.red);
    // _.each(lineObjects, lineObject => {
    //     console.log(`${lineObject.id.toString().green}\t${lineObject.type.yellow}`);
    //     console.log(lineObject.content);
    // });
    return lineObjects;
}

// Inter-line connections, better tokenize content, define set of variables
function processLineObjects(lineObjects) {
    let braceSightnings, myStak, myIndexes, mySightnings;
    // Check empty bracket expression
    for (let i = 0; i<lineObjects.length-2; i++) {
        if (lineObjects[i].type === lineTypes.LBRACE && lineObjects[i+1].type === lineTypes.RBRACE) {
            let err = new Error('');
            err.type = 'Empty Bracket';
            err.content = {
                leftBr: i,
                rightBr: i+1
            };
            throw err;
        }
    }
    // Assign if_else_ids, while ids, for ids
    braceSightnings = 0;
    for (let i = 0; i<lineObjects.length; i++) {
        let line = lineObjects[i];
        if (line.type === lineTypes.IF) {
            lineObjects[i].content.if_else_id = braceSightnings;
        } else if (line.type === lineTypes.ELSE) {
            lineObjects[i].content.if_else_id = braceSightnings;
        } else if (line.type === lineTypes.LBRACE) {
            braceSightnings++;
        } else if (line.type === lineTypes.RBRACE) {
            braceSightnings--;
        }
    }
    // Assign bracket return pointers for right bracket of while loops
    myStak = [];
    myIndexes = [];
    mySightnings = [];
    braceSightnings = 0;
    for (let i = 0; i<lineObjects.length; i++) {
        let line = lineObjects[i];
        if (line.type === lineTypes.W_WHILE) {
            myStak.push(line.id);
            myIndexes.push(i);
            mySightnings.push(braceSightnings);
            lineObjects[i].content.jumpTrue = lineObjects[i+1].id;
        } else if (line.type === lineTypes.LBRACE) {
            braceSightnings++;
        } else if (line.type === lineTypes.RBRACE) {
            braceSightnings--;
            let myBracket = mySightnings.pop();
            if (myBracket === braceSightnings) {
                let whileIdx = myIndexes.pop();
                lineObjects[i].content.jump = myStak.pop();
                lineObjects[i].content.while_id = lineObjects[whileIdx].content.while_id;
                lineObjects[whileIdx].content.jumpFalse = lineObjects[i+1].id;
            } else {
                mySightnings.push(myBracket);
            }
        }
    }
    // Assign bracket return pointers for do_while loops
    myStak = [];
    myIndexes = [];
    mySightnings = [];
    braceSightnings = 0;
    for (let i = 0; i<lineObjects.length; i++) {
        let line = lineObjects[i];
        if (line.type === lineTypes.DO) {
            myStak.push(line.id);
            myIndexes.push(i);
            mySightnings.push(braceSightnings);
            lineObjects[i].content.jump = lineObjects[i+1].id;
        } else if (line.type === lineTypes.LBRACE) {
            braceSightnings++;
        } else if (line.type === lineTypes.RBRACE) {
            braceSightnings--;
            let myBracket = mySightnings.pop();
            if (myBracket === braceSightnings) {
                // Next statement should be a DW_WHILE
                lineObjects[i].content.jump = lineObjects[i+1].id; // rbrace goes to next statement
                lineObjects[i+1].content.jumpTrue = myStak.pop(); // if true go to DO
                lineObjects[myIndexes.pop()].content.while_id = lineObjects[i+1].content.while_id;
                lineObjects[i+1].content.jumpFalse = lineObjects[i+2].id; // if false go to next line
            } else {
                mySightnings.push(myBracket);
            }
        }
    }
    // Assign bracket return content for end of for loops
    myStak = [];
    myIndexes = [];
    mySightnings = [];
    braceSightnings = 0;
    for (let i = 0; i<lineObjects.length; i++) {
        let line = lineObjects[i];
        if (line.type === lineTypes.FOR) {
            myStak.push(line.id);
            myIndexes.push(i);
            mySightnings.push(braceSightnings);
            lineObjects[i].content.jumpTrue = lineObjects[i+1].id;
        } else if (line.type === lineTypes.LBRACE) {
            braceSightnings++;
        } else if (line.type === lineTypes.RBRACE) {
            braceSightnings--;
            let myBracket = mySightnings.pop();
            if (myBracket === braceSightnings) {
                let forIdx = myIndexes.pop();
                lineObjects[i].content.jump = myStak.pop();
                lineObjects[i].content.for_id = lineObjects[forIdx].content.for_id;
                let [update_lhs, update_rhs] = lineObjects[forIdx].content.update.split('=').map(x => x.trim());
                lineObjects[i].content.update_lhs = update_lhs;
                lineObjects[i].content.update_rhs = update_rhs;
                lineObjects[forIdx].content.jumpFalse = lineObjects[i+1].id;
            } else {
                mySightnings.push(myBracket);
            }
        }
    }
    // Assign onTrue and onFalse for IF-ELSE statements, onTrue goes to next line, onFalse goes to ELSE line
    for (let i = 0; i<lineObjects.length; i++) {
        let line = lineObjects[i];
        if (line.type === lineTypes.IF) {
            let j = i;
            // keep going until you find an ELSE with same id
            while (j < lineObjects.length && !(lineObjects[j].type === lineTypes.ELSE && lineObjects[j].content.if_else_id === line.content.if_else_id)) {
                j++;
            }
            if (j < lineObjects.length) {
                // found corresponding ELSE for this IF line
                let else_line = j;
                lineObjects[i].content.jumpTrue = line.id+1; // go next line on true
                lineObjects[i].content.jumpFalse = lineObjects[else_line].id; // go the ELSE line on false
                // the line RBRACE before ELSE should skip to RBRACE at the end of ELSE
                j++;
                braceSightnings = 0;
                if (lineObjects[j].type === lineTypes.LBRACE) {
                    braceSightnings++;
                }
                while (braceSightnings > 0) {
                    j++;
                    if (lineObjects[j].type === lineTypes.LBRACE) {
                        braceSightnings++;
                    } else if (lineObjects[j].type === lineTypes.RBRACE) {
                        braceSightnings--;
                    }
                }
                // j shows the RBRACE end of ELSE
                lineObjects[else_line-1].content.jump = lineObjects[j].id;
            } else {
                // no ELSE found, could be an IF with no false
                j = i;
                j++;
                braceSightnings = 0;
                if (lineObjects[j].type === lineTypes.LBRACE) {
                    braceSightnings++;
                }
                while (braceSightnings > 0) {
                    j++;
                    if (lineObjects[j].type === lineTypes.LBRACE) {
                        braceSightnings++;
                    } else if (lineObjects[j].type === lineTypes.RBRACE) {
                        braceSightnings--;
                    }
                }
                // end of IF found
                lineObjects[i].content.jumpTrue = line.id+1;
                lineObjects[i].content.jumpFalse = lineObjects[j].id;
            }
        }
    }
    // Assign jump to all ASSIGN, ELSE, LBRACE and unoccupied RBRACE except the last one
    for (let i = 0; i<lineObjects.length-1; i++) {
        let line = lineObjects[i];
        if (_.includes([lineTypes.ASSIGN, lineTypes.LBRACE, lineTypes.ELSE, lineTypes.INITIAL, lineTypes.DO], line.type)) {
            lineObjects[i].content.jump = lineObjects[i+1].id;
        }  else if (line.type === lineTypes.RBRACE && Utils.isEmpty(line.content)) {
            lineObjects[i].content.jump = lineObjects[i+1].id;
        }
    }
    // Assign loop ids to all LBRACE coming after a loop
    for (let i = 0; i<lineObjects.length-1; i++) {
        let line = lineObjects[i];
        // line i+1 should be LBRACE
        if (line.type === lineTypes.FOR) {
            lineObjects[i+1].content.for_id = line.content.for_id;
        } else if (line.type === lineTypes.W_WHILE) {
            lineObjects[i+1].content.while_id = line.content.while_id;
        } else if (line.type === lineTypes.DO) {
            lineObjects[i+1].content.while_id = line.content.while_id;
        }
    }

    // console.log('\nProcessing lines Phase 2'.magenta);
    // _.each(lineObjects, lineObject => {
    //     console.log(`${lineObject.id.toString().green}\t${lineObject.type.yellow}`);
    //     console.log(lineObject.content);
    // });

    return lineObjects;
}

// Converts line objects to math line objects
function convertLineObjectsToMathObjects(lineObjects) {
    Mathematical.setVariableSet(symbols);
    Mathematical.setInputSet(lineObjects[0].content.inputs); // Inputs are obtained from Initial line
    Exporter.setSetofVariables(symbols);
    Exporter.setSetofInputs(lineObjects[0].content.inputs);
    Mathematical.setSymbols(symbols);
    let mathObj;
    let mathObjectsArray = [];
    _.each(lineObjects, line => {
        switch (line.type) {
            case lineTypes.INITIAL:
                mathObj = Mathematical.initialLine(line.content.functionName, line.content.jump);
                break;
            case lineTypes.ASSIGN:
                mathObj = Mathematical.assignLine(line.id, line.content.jump, line.content.leftHandSide, line.content.rightHandSide);
                break;
            case lineTypes.LBRACE:
                mathObj = Mathematical.directLine(line.id, line.content.jump);
                break;
            case lineTypes.RBRACE:
                if (Utils.isEmpty(line.content)) {
                    // End of program right brace
                    mathObj = Mathematical.program_end(line.id);
                } else if (line.content.hasOwnProperty('update_lhs') && line.content.hasOwnProperty('update_rhs')) {
                    // Does the 3rd operation of for loop when the loop ends
                    mathObj = Mathematical.forAssignLine(line.id, line.content.for_id, line.content.update_lhs, line.content.update_rhs);
                } else {
                    // Normal right brace
                    mathObj = Mathematical.directLine(line.id, line.content.jump);
                }
                break;
            case lineTypes.ELSE:
                mathObj = Mathematical.directLine(line.id, line.content.jump);
                break;
            case lineTypes.IF:
                mathObj = Mathematical.ifLine(line.id, line.content.jumpTrue, line.content.jumpFalse, line.content.cond);
                break;
            case lineTypes.RETURN:
                mathObj = Mathematical.returnLine(line.id, line.content.returns);
                break;
            case lineTypes.W_WHILE:
                mathObj = Mathematical.whileLine(line.id, line.content.while_id, line.content.jumpTrue, line.content.jumpFalse, line.content.cond);
                break;
            case lineTypes.DO:
                mathObj = Mathematical.directLine(line.id, line.content.jump);
                break;
            case lineTypes.DW_WHILE:
                mathObj = Mathematical.whileLine(line.id, line.content.while_id, line.content.jumpTrue, line.content.jumpFalse, line.content.cond);
                break;
            case lineTypes.FOR:
                mathObj = Mathematical.forLine(line.id, line.content.for_id, line.content.jumpTrue, line.content.jumpFalse, line.content.cond, line.content.initial);
                break;
        }
        if (Array.isArray(mathObj)) {
            _.each(mathObj, obj =>  mathObjectsArray.push(obj));
        } else {
            mathObjectsArray.push(mathObj)
        }

    });


    // console.log('\nProcessing lines Phase 3'.cyan);
    // console.log('VARIABLE SET: '.blue,Mathematical.getVariableSet());
    // console.log('INPUT SET: '.blue,Mathematical.getInputSet()+'\n');
    // _.each(mathObjectsArray, obj => {
    //     if (obj.left.type === mathLineTypes.INITIAL) {
    //         console.log(obj.string.bold);
    //     } else if (obj.left.type === mathLineTypes.SEQUENCE ) {
    //         console.log(obj.string);
    //     } else if (obj.left.type === mathLineTypes.LOOP) {
    //         console.log(obj.string);
    //     } else if (obj.left.type === mathLineTypes.FINAL) {
    //         console.log(obj.string.bold);
    //     }
    // });
    return mathObjectsArray;
}

// Squish math lines
function squishMathObjects(mathObjectsArray) {
    // Generate an access-by-id version of mathObjectsArray
    let mathObjectsObj = {};
    _.each(mathObjectsArray, obj => {
        mathObjectsObj[obj.left.name + obj.left.id] = obj;

    });
    // Find starting objects using the array
    let startingObjects = [];
    _.each(mathObjectsArray, obj => {
        if (obj.left.type === mathLineTypes.INITIAL || obj.left.type === mathLineTypes.LOOP) {
            startingObjects.push(obj);
        }
    });
    // Squish these starting functions using mathObjectsObj
    let squishedMathObjects = [];
    let squishedMathObj = {};
    _.each(startingObjects, startObj => {
        /*
        How to use memory?
        memoryIndex is an array:
        ['a', 'b', 'c']
        memoryObjects is an object:
        {
            'a': value of a at that moment
            'b': value of b at that moment
            'c': value of c at that moment
        }
        Accessing:
        memoryObjects[memoryIndex[params[0]]] gives us the 0th object which we can later access by its name
         */
        let memoryIndex = Mathematical.getVariableSet();
        let memoryObject = {};
        _.each(Mathematical.getVariableSet(), variable => {
            memoryObject[variable] = variable;
        });

        let squishedRight = getRight(startObj.right, memoryObject, memoryIndex);
        squishedMathObj = {
            left: startObj.left,
            right: squishedRight
        };
        squishedMathObjects.push(squishedMathObj);


    });
    squishedMathObjects = attachStringToSquishedMathObjects(squishedMathObjects);

    // console.log('\nProcessing lines Phase 4'.magenta);
    // _.each(squishedMathObjects, squishedMathObj => {
    //     console.log(squishedMathObj.string);
    // });
    return squishedMathObjects;

    function getRight(curRight, memoryObject, memoryIndex) {
        // First load default memory to the line
        if ((curRight.hasOwnProperty('type') && curRight.type === mathLineTypes.LOOP) || (curRight.hasOwnProperty('type') && curRight.type === mathLineTypes.FINAL) || curRight.hasOwnProperty('returns')) {
            // branch: Termination condition
            if (curRight.hasOwnProperty('returns')) {
                // branch: Sequence Final
                // Replace every expression with their memory values
                _.each(memoryIndex, variable => {
                    curRight.returns = Utils.variableReplacer(curRight.returns, variable, memoryObject[variable]);
                });
                return curRight;
            } else {
                // branch: loop assign
                for (let i = 0; i<curRight.params.length; i++) {
                    _.each(memoryIndex, variable => {
                        curRight.params[i] = Utils.variableReplacer(curRight.params[i], variable, memoryObject[variable]);
                    });
                }
                return curRight;
            }
        }
        // Inside the loop we only expect SEQUENCE
        if (curRight.name === '\\Delta') { // Delta is a static name for conditional expressions
            // branch: Sequence Conditional
            // We have onTrue and onFalse, and we have to process each of them
            // onTrue line object
            let onTrue = curRight.onTrue;
            let onTrueMemoryObj = JSON.parse(JSON.stringify(memoryObject));
            for (let i = 0; i<onTrue.params.length; i++) {
                _.each(memoryIndex, variable => {
                    onTrue.params[i] = Utils.variableReplacer(onTrue.params[i], variable, onTrueMemoryObj[variable]);

                });
            }
            // Then we update everything with this their new form
            _.each(onTrue.params, (param, idx) => {
                onTrueMemoryObj[memoryIndex[idx]] = param;
            });
            // onFalse line object
            let onFalse = curRight.onFalse;
            let onFalseMemoryObj = JSON.parse(JSON.stringify(memoryObject));
            for (let i = 0; i<onFalse.params.length; i++) {
                _.each(memoryIndex, variable => {
                    onFalse.params[i] = Utils.variableReplacer(onFalse.params[i], variable, onFalseMemoryObj[variable]);
                });
            }
            // Then we update everything with this their new form
            _.each(onFalse.params, (param, idx) => {
                onFalseMemoryObj[memoryIndex[idx]] = param;
            });

            // Also update condition
            let editedCondition = curRight.condition;
            _.each(memoryIndex, variable => {
                editedCondition = Utils.variableReplacer(editedCondition, variable, memoryObject[variable]);

            });
            return {
                name: curRight.name,
                condition: editedCondition,
                onTrue: getRight(JSON.parse(JSON.stringify(mathObjectsObj[onTrue.name + onTrue.id].right)), onTrueMemoryObj, memoryIndex),
                onFalse: getRight(JSON.parse(JSON.stringify(mathObjectsObj[onFalse.name + onFalse.id].right)), onFalseMemoryObj, memoryIndex)
            };
        } else {
            // branch: Direct Sequence
            // First we write everything as we have:
            for (let i = 0; i<curRight.params.length; i++) {
                _.each(memoryIndex, variable => {
                    curRight.params[i] = Utils.variableReplacer(curRight.params[i], variable, memoryObject[variable]);
                });
            }
            // Then we update everything with this their new form
            _.each(curRight.params, (param, idx) => {
                memoryObject[memoryIndex[idx]] = param;
            });
            return getRight(JSON.parse(JSON.stringify(mathObjectsObj[curRight.name + curRight.id].right)), memoryObject, memoryIndex);
        }
    }
    function attachStringToSquishedMathObjects(squishedMathObjects) {
        _.each(squishedMathObjects, obj => {
            // We need to write a string LaTeX representation of this squished object
            if (obj.left.type === mathLineTypes.INITIAL) {
                obj.string = `${obj.left.name}(${obj.left.params}) = ${getMathObjString(obj.right)}`
            } else {
                obj.string = `${getMathObjString(obj.left)} = ${getMathObjString(obj.right)}`
            }

        });
        return squishedMathObjects;

        function getMathObjString(mathObj) {
            if (mathObj.name === '\\Delta') {
                // branch: conditional
                return `${mathObj.name}_{${mathObj.condition}}(${getMathObjString(mathObj.onTrue)},${getMathObjString(mathObj.onFalse)})`;
            } else if (mathObj.hasOwnProperty('returns')) {
                // branch: return
                return `${mathObj.returns}`;
            } else {
                // branch: loop
                return `${mathObj.name}_{${mathObj.id}}(${mathObj.params})`;
            }
        }
    }
}

global.parserlib = {
    // Called by parser
    onParse(type, param) {
        if (type === 'IDENTIFIER') {
            if (!symbols.hasOwnProperty(param)) {
                symbols[param] = {
                    text: param,
                    token: 'IDENTIFIER',
                    isFunction: true
                }
            } else {
                symbols[param].isFunction = true;
            }
        } else if (type === 'MATH_EXPR') {
            console.log(param);
        }
    },
    // Called by lexer
    onLex(type, param) {
        if (type === 'IDENTIFIER') {
            if (!symbols.hasOwnProperty(param)) {
                symbols[param] = {
                    text: param,
                    token: 'IDENTIFIER'
                }
            }
        }
    }
};