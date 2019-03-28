const SourceCodeProcessor = require('./SourceCodeProcessor');
const Exporter = require('./Exporter');
const _ = require('lodash');
const fs = require('fs');
const colors = require('colors');
let fileName = 'input';

if (process.argv[2] != null) {
    fileName = process.argv[2];
}
let codePath = './Inputs/' + fileName + '.txt';
const latexPath = './Outputs/' + fileName + '.tex';
let pdfPath = './Outputs/' +  fileName + '.pdf';
let jsPath = './Outputs/' +  fileName + '.js';

// todo: array with math func problem with comma
let code = fs.readFileSync(codePath, 'UTF8').toString();
code = code.replace(/\/\/.*[\n|\r\n]|\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g, '').trim(); // Remove comments and trim
code = code.replace(/\s*,\s*/g, ', '); // replace comma separations with single spaced comma separations (otherwise it may meddle with the regex)
try {
    SourceCodeProcessor.process(code);
} catch (err) {
    if (err.hash) {
        // Thrown by parser
        console.log('\n\nSyntax Error'.red.bold);
        console.log(`Expected ${err.hash.expected.toString().blue} at line ${err.hash.line.toString().yellow}, Got '${err.hash.token.blue}'`);
        console.log(`At text: ${err.hash.text.blue}`);
        console.log(`Location: ${err.hash.loc.first_line.toString().yellow}:${err.hash.loc.first_column.toString().yellow} to ${err.hash.loc.last_line.toString().yellow}:${err.hash.loc.last_column.toString().yellow}`);
    } else if (err.type === 'Empty Bracket') {
        console.log('\n\nSemantic Error'.red.bold);
        console.log('Empty brackets are not allowed!');
        console.log(`Lines: ${err.content.leftBr.toString().yellow} - ${err.content.rightBr.toString().yellow}`)
    } else if (err.type === 'Symbols') {
        console.log('\n\nSemantic Error'.red.bold);
        console.log('A variable can\'t be an array and dimension at the same time!');
        console.log(`${JSON.stringify(err.content.culprit, null, 4)}`.yellow);
    } else if (err.type === 'Array Usage') {
        console.log('\n\nSemantic Error'.red.bold);
        console.log('A non-array variable can\'t be used like an array!');
        console.log(`${JSON.stringify(err.content.culprit, null, 4)}`.yellow);
    } else {
        console.error('ERROR DURING FRONTEND:\n',err);
    }
    programTerminate();
}

try {
    console.log('\nExporting...'.blue);
    Exporter.setLatexPath(latexPath);
    Exporter.setPDFPath(pdfPath);
    Exporter.setJsPath(jsPath);
    Exporter.prepareLatex();
    Exporter.exportLatex();
    Exporter.exportJS();
} catch (err) {
    console.error('ERROR DURING EXPORTING:\n',err);
    programTerminate();
}


function programTerminate() {
    console.log('PROGRAM TERMINATED DUE TO AN ERROR'.red);
    process.exit(1);
}

/*
If LaTeX gives error ENOENT indicating some kind of textlog.txt is missing, try to run the code with another .txt file from the INPUT folder.
 */