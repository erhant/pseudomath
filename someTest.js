const _ = require('lodash');

let someStr = '3 + min - i+ 5 - 289 -i + i';
let variable = 'min';

console.log(someStr);
someStr = variableReplacer(someStr, variable, '10');
console.log(someStr);

function variableReplacer(string, variableName, expr) {
    string = ` ${string} `;
    let pattern = `[^a-zA-Z0-9]${variable}[^a-zA-Z0-9]`;
    let arr = string.match(new RegExp(pattern, 'g'));
    _.each(arr, a => {
        string = string.replace(a, a.replace(variableName, expr));
    });
    return string.trim();
}