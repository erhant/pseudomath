let Parser = require('expr-eval').Parser;
const latex = require('node-latex');
const fs = require('fs');
const _ = require('lodash');
const Constants = require('./Constants');
let inputCode;
let convertedLineNotation;
let squishedLineNotation;
let convertedCode;
let variableSet;
let inputSet;
let functionSet;
let initialFunction;
let latexPath;
let pdfPath;
let jsPath;
let tupleRepresentation;

module.exports = {

    setSetofVariables(variables) {
        let vars = [];
        _.each(variables, variable => {
            if (!variable.isFunction) {
                vars.push(variable.text);
            }
        });
        variableSet = '\\{'+vars.join(',')+'\\}';
    },

    setSetofInputs(inputs) {
        let ins = [];
        _.each(inputs, input => {
            ins.push(input);
        });
        inputSet = '\\{'+ins.join(',')+'\\}';
    },

    setSetofFunctions(mathObjects) {
        let functions = [];
        _.each(mathObjects, obj => {
            if (obj.left.type === 'INITIAL') {
                functions.push(obj.left.name);
                initialFunction = obj.left.name;
            } else {
                functions.push(obj.left.name + '_{' +obj.left.id + '}');
            }

        });
        functionSet = '\\{'+functions.join(',')+'\\}';
    },

    set4Tuple() {
        tupleRepresentation = `$$
        \\mathbb{M}(\\mathbb{V},\\mathbb{I},$\\mathbb{F},\\mathbb{P})
        $$
        $$
        \\mathbb{V} = ${variableSet} 
        $$
        $$
        \\mathbb{I} = ${inputSet}
        $$
        $$
        \\mathbb{F} = ${functionSet}
        $$
        $$
        \\mathbb{P} = ${initialFunction}
        $$
        `;
    },

    setInputCode(code) {
        // Need to upgrade braces according to their scope
        let lines = code.split('\n').map(x => x.trim());
        let bracesSeen = 0;
        const space_per_tab = 3;
        _.each(lines, (line, idx) => {
            if (line === '{') {
                lines[idx] = givemespaces(bracesSeen*space_per_tab) + line;
                bracesSeen++;
            } else if (line === '}') {
                bracesSeen--;
                lines[idx] = givemespaces(bracesSeen*space_per_tab) + line;
            } else {
                lines[idx] = givemespaces(bracesSeen*space_per_tab) + line;
            }
        });
        inputCode = lines.join('\n');

        function givemespaces(n) {
            let str = '';
            for (let i = 0; i<n; i++) str += ' ';
            return str;
        }
    },

    setConvertedLineNotation(mathObjects) {
        convertedLineNotation = '';
        _.each(mathObjects, obj => {
            convertedLineNotation +=
            '\\begin{equation*}\\begin{split}\n'
            + latexify(obj.string)
            + '\n\\end{split}\\end{equation*}\n'}
            );

    },

    setConvertedCode(code) {
        convertedCode = code;
    },

    setSquishedLineNotation(squishedMathObjects) {
        squishedLineNotation = '';
        _.each(squishedMathObjects, obj => squishedLineNotation +=
            '\\begin{equation*}\\begin{split}\n'
            + latexify(obj.string)
            + '\n\\end{split}\\end{equation*}\n');
    },

    setLatexPath(path) {
        latexPath = path;
    },

    setPDFPath(path) {
        pdfPath = path;
    },

    setJsPath(path) {
        jsPath = path;
    },

    prepareLatex() {
        let writeStr =
`
\\documentclass{article}
\\usepackage{listings} 
\\usepackage{color} %use color
\\usepackage{amsmath}
\\usepackage{mathpazo}
\\usepackage[mathpazo]{flexisym}
\\usepackage{breqn} 

\\newcommand*{\\mysqrt}[4]{\\sqrt[\\leftroot{#1}\\uproot{#2}#3]{#4}}

\\lstset{ 
backgroundcolor=\\color{white},
basicstyle=\\footnotesize, 
breakatwhitespace=false, 
breaklines=true, 
captionpos=b,
commentstyle=\\color{mygreen},
deletekeywords={...}, 
escapeinside={\\%*}{*)}, 
extendedchars=true,
frame=single,
keepspaces=true,
keywordstyle=\\color{blue},
morekeywords={*,...},
numbers=left,
numbersep=5pt,
numberstyle=\\tiny\\color{mygray},
rulecolor=\\color{black},
showspaces=false,
showstringspaces=false,
showtabs=false,
stepnumber=1,
stringstyle=\\color{mymauve}, 
tabsize=2,
title=\\lstname 
}
 
\\definecolor{darkgray}{rgb}{.4,.4,.4}
\\definecolor{purple}{rgb}{0.65, 0.12, 0.82}
\\definecolor{mygreen}{rgb}{0,0.6,0}
\\definecolor{mygray}{rgb}{0.5,0.5,0.5}
\\definecolor{mymauve}{rgb}{0.58,0,0.82}
 
\\lstdefinelanguage{JavaScript}{
keywords={typeof, new, true, false, catch, function, return, null, catch, switch, var, if, for, in, while, do, else, case, break},
keywordstyle=\\color{blue}\\bfseries,
ndkeywords={class, export, boolean, throw, implements, import, this},
ndkeywordstyle=\\color{darkgray}\\bfseries,
identifierstyle=\\color{black},
sensitive=false,
comment=[l]{//},
morecomment=[s]{/*}{*/},
commentstyle=\\color{purple}\\ttfamily,
stringstyle=\\color{red}\\ttfamily,
morestring=[b]',
morestring=[b]"
}
 
\\lstset{
language=JavaScript,
extendedchars=true,
basicstyle=\\footnotesize\\ttfamily,
showstringspaces=false,
showspaces=false,
numbers=left,
numberstyle=\\footnotesize,
numbersep=9pt,
tabsize=2,
breaklines=true,
showtabs=false,
captionpos=b
}
\\begin{document}
\\title{AUTOMATICALLY GENERATED LATEX}
\\maketitle

\\subsection{INPUT CODE}
\\begin{lstlisting}[language=JavaScript]
${inputCode}
\\end{lstlisting}

\\subsection{CONVERTED LINES}
${convertedLineNotation}

\\subsection{SQUISHED LINES}
${squishedLineNotation}

\\subsection{CONVERTED CODE}
\\begin{lstlisting}[language=JavaScript]
${convertedCode}
\\end{lstlisting}

\\end{document}
`;
        // if some lines are too long divide them in parts
        fs.writeFile(latexPath, writeStr, err => err ? console.log(err) : console.log('Preparations done!') );
    },

    exportLatex() {

        const input = fs.createReadStream(latexPath);
        const output = fs.createWriteStream(pdfPath);
        const pdf = latex(input);

        pdf.pipe(output);
        pdf.on('error', err => console.error(err));
        pdf.on('finish', () => {
            console.log('PDF generated!');
            console.log('Completed!'.blue);
        });
    },

    exportJS() {
        fs.writeFileSync(jsPath, convertedCode);
        console.log('JavaScript exported!');
    }
};

function latexify(string) {
    // Function translator
    let functionsTmpStr = string;
    while (Constants.mathematicalFunctionsRegExp.test(functionsTmpStr)) {
        // Functions in the string
        let functions = functionsTmpStr.match(Constants.mathematicalFunctionsRegExp);
        // Check if it is a function identifier perhaps
        let regExpFuncId = new RegExp(`^\\s+\\w+${functions[0]}\\s*\\(` , 'i');
        if (/\w/.test(functionsTmpStr.charAt(functions.index-1))) {
            // This is a false positive, the function is part of identifier...
            // do nothing
            functionsTmpStr = functionsTmpStr.substring(functions.index+functions[0].length);
        } else {
            // Extract parameters
            let parameterString = functionsTmpStr.substring(functions.index);
            let parameterStringArr = [...parameterString];
            let param1Arr = [];
            let param2Arr = [];
            let funcNameArr = [];
            let hasSecondParam = false;
            let parenthesesSightnings = 0;
            let continueLoop = true;
            let i = 0;
            let skipOnce = false;
            while (continueLoop) {
                    switch (parameterStringArr[i]) {
                        case '(':
                            parenthesesSightnings++;
                            if (parenthesesSightnings === 1) {
                                skipOnce = true;
                            }
                            break;
                        case ')':
                            parenthesesSightnings--;
                            if (parenthesesSightnings === 0) {
                                continueLoop = false;
                                skipOnce = true;
                            }
                            break;
                        case Constants.parameterCommaPlaceholder:
                            if (parenthesesSightnings===1) {
                                hasSecondParam = true;
                                skipOnce = true;
                            }
                            break;
                        default: break;
                    }
                    if (skipOnce) {
                        skipOnce = false;
                    } else {
                        if (parenthesesSightnings > 0) {
                            if (parameterStringArr[i])
                                if (hasSecondParam) {
                                    param2Arr.push(parameterStringArr[i]);
                                } else {
                                    param1Arr.push(parameterStringArr[i]);
                                }
                        } else {
                            funcNameArr.push(parameterStringArr[i]);
                        }
                    }
                i++;
            }
            parameterString = parameterString.substring(0,i);
            let param1 = param1Arr.join('');
            let param2 = param2Arr.join('');
            let funcName = funcNameArr.join('');
            let resultStr = '';
            switch(funcName) {
                case 'pow':
                    resultStr = `{(${param1})}^{(${param2})}`;
                    break;
                case 'div':
                    resultStr = `\\frac{${param1}}{${param2}}`;
                    break;
                case 'root':
                    // could also use  2, -2
                    resultStr = `\\mysqrt{2}{2}{${param2}}{${param1}}`;
                    break;
                case 'sqrt':
                    resultStr = `\\sqrt{${param1}}`;
                    break;
                case 'fact':
                    resultStr = `(${param1})!`;
                    break;
                case 'abs':
                    resultStr = ` | ${param1} | `;
                    break;
                case 'floor':
                    resultStr = `\\lfloor ${param1} \\rfloor `;
                    break;
                case 'ceil':
                    resultStr = `\\lceil ${param1} \\rceil `;
                    break;
                case 'sin':
                    resultStr = `\\sin(${param1})`;
                    break;
                case 'cos':
                    resultStr = `\\cos(${param1})`;
                    break;
                case 'tan':
                    resultStr = `\\tan(${param1})`;
                    break;
                case 'cot':
                    resultStr = `\\cot(${param1})`;
                    break;
                case 'csc':
                    resultStr = `\\csc(${param1})`;
                    break;
                case 'sec':
                    resultStr = `\\sec(${param1})`;
                    break;
                case 'arcsin':
                    resultStr = `\\arcsin(${param1})`;
                    break;
                case 'arccos':
                    resultStr = `\\arccos(${param1})`;
                    break;
                case 'arctan':
                    resultStr = `\\arctan(${param1})`;
                    break;
            }
            // Remove the last parentheses from parameterString
            //parameterString = parameterString.substring(0,parameterString.length-1);
            functionsTmpStr = functionsTmpStr.replace(parameterString, resultStr);
        }
    }
    string = functionsTmpStr;

    string = string
        .replace(/&&/g, " \\land ")
        .replace(/\|\|/g, " \\lor ")
        .replace(/>=/g, ` \\geq `)
        .replace(/<=/g, ` \\leq `)
        .replace(/!=/g, ` \\ne `)
        .replace(/!/g, ' \\lnot ')
        .replace(/%/g, ' \\bmod{}')
        .replace(/\*/g, ' \\times ')
        .replace(new RegExp(Constants.parameterCommaPlaceholder, 'g'), ',')
        .replace(new RegExp(Constants.dimensionCommaPlaceholder, 'g'), ',')
        .replace(/\(/g, ' \\left(')
        .replace(/\)/g, ' \\right)');
        //.replace('=', '= \\\\')
        //.replace('\\Delta', '\\\\ \\Delta');

    return string;
}
