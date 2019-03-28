module.exports = {
    parameterCommaPlaceholder: '~', // Used for parameters for pow(), div() etc.
    dimensionCommaPlaceholder: '#', // Used for dimensions in delta indexing function
    semiColonPlaceHolder: ':::', // Used during for loops in frontend
    mathematicalFunctionsRegExp: /(pow|div|root|sqrt|fact|abs|floor|ceil|sin|cos|tan|cot|sec|csc|arctan|arccos|arcsin)\s*(?=\()/i
};