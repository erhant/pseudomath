const _ = require('lodash');
const Constants = require('./Constants');
// https://stackoverflow.com/questions/22646996/how-do-i-run-a-node-js-script-from-within-another-node-js-script

let functionsString = '';
module.exports = {

    convertToCode(mathObjects) {
        _.each(mathObjects, obj => {
            let declaration = '';
            let body = '';
            // LEFT
            if (obj.left.type === 'INITIAL') {
                declaration = `${obj.left.name}(${obj.left.params.join(',')})`;
            } else {
                declaration = `${obj.left.name+obj.left.id}(${obj.left.params.join(',')})`;
            }

            // RIGHT
            body = processRight(obj.right)
                .replace(/\(\s*/g, '( ')
                .replace(/\)\s*/g, ')')
                .replace(/\\infty/g, 'null')
                .replace(new RegExp(Constants.dimensionCommaPlaceholder, 'g'), ',')
                .replace(new RegExp(Constants.parameterCommaPlaceholder, 'g'), ',')
                .replace(/\Wsqrt\W/g, ' Math.sqrt' )
                .replace(/\Wpow\W/g, ' Math.pow')
                .replace(/\Wabs\W/g, ' Math.abs')
                .replace(/\Wfloor\W/g, ' Math.floor')
                .replace(/\Wceil\W/g, ' Math.ceil')
                .replace(/\Wsin\W/g, 'Math.sin')
                .replace(/\Wcos\W/g, 'Math.cos')
                .replace(/\Wtan\W/g, 'Math.tan')
                .replace(/\Wsec\W/g, 'Math.sec')
                .replace(/\Wcsc\W/g, 'Math.csc')
                .replace(/\Warcsin\W/g, 'Math.asin')
                .replace(/\Warccos\W/g, 'Math.acos')
                .replace(/\Warctan\W/g, 'Math.atan');
            functionsString+=`function ${declaration} {
    return ${body};
}
`;
        });

        return functionsString;

        function processRight(obj) {
            if (obj.name === '\\Delta') {
                return `(${obj.condition}) ? ${processRight(obj.onTrue)} : ${processRight(obj.onFalse)}`;
            } else if (obj.hasOwnProperty('returns')) {
                return `${obj.returns}`;
            } else {
                return `${obj.name+obj.id}(${obj.params.join(',')})`;
            }
        }
    }
};