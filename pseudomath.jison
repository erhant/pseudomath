%lex
%options case-insensitive

%%
\s+								/* ignore whitespace */
<<EOF>>							{return 'EOF'}
/* -?\d+(?:\.\d+)?(?:e[+\-]?\d+)?	return 'NUMBER' */
[0-9]+("."[0-9]+)?\b			{return 'NUMBER'}
/* Mathematical Functions >>> */
'POW'                           {return 'POW'}
'DIV'                           {return 'DIV'}
'ABS'                           {return 'ABS'}
'FLOOR'                         {return 'FLOOR'}
'CEIL'                          {return 'CEIL'}
'SQRT'                          {return 'SQRT'}
'ROOT'                          {return 'ROOT'}
'FACT'                          {return 'FACT'}
'SIN'                           {return 'SIN'}
'COS'                           {return 'COS'}
'TAN'                           {return 'TAN'}
'COT'                           {return 'COT'}
'SEC'                           {return 'SEC'}
'CSC'                           {return 'CSC'}
'ARCSIN'                        {return 'ARCSIN'}
'ARCCOS'                        {return 'ARCCOS'}
'ARCTAN'                        {return 'ARCTAN'}
/* <<< Mathematical Functions */
/* Mathematical Operators >>> */
'-'								{return '-'}
'*'								{return '*'}
'+'								{return '+'}
'/'								{return '/'}
'%'                             {return 'MOD'}
/* <<< Mathematical Operators */
/* Relational Operators >>> */
'<='                            {return 'RELOP'}
'<'                             {return 'RELOP'}
'>='                            {return 'RELOP'}
'>'                             {return 'RELOP'}
'=='                            {return 'RELOP'}
'!='                            {return 'RELOP'}
/* <<< Relational Operators */
/* Logical Operators >>> */
'||'                            {return 'OR'}
'&&'                            {return 'AND'}
'!'                             {return 'NOT'}
/* <<< Logical Operators */
'('								{return 'LPAREN'}
')'								{return 'RPAREN'}
';'								{return 'SEMICOLON'}
'{'								{return 'LBRACE'}
'}'								{return 'RBRACE'}
'['								{return 'LBRACKET'}
']'								{return 'RBRACKET'}
','								{return 'COMMA'}
'='								{return 'ASSIGN'}
'IF'							{return 'IF'}
'ELSE'							{return 'ELSE'}
'WHILE'							{return 'WHILE'}
'DO'							{return 'DO'}
'FOR'                           {return 'FOR'}
'TRUE'							{return 'TRUE'}
'FALSE'							{return 'FALSE'}
'RETURN'						{return 'RETURN'}
[a-zA-Z][a-zA-Z0-9]*			{
                                parserlib.onLex('IDENTIFIER', yytext);
                                return 'IDENTIFIER';
                                }


/lex

/* OPERATOR PRECEDENCES */

%left '+' '-'
%left '*' '/'
%left '^'
%left '!'
%left UMINUS
%right ASSIGN

%start program
%%

/* use yytext to reach text recieved or a dollar sign and position to get SYMBOL in the rule */

/* Start state */
program
	: nonarray_identifier initial_paren_expr brace_expr EOF
	{parserlib.onParse('IDENTIFIER', $1); }
	;
	
initial_paren_expr
	: LPAREN input_identifier RPAREN
	| LPAREN RPAREN
	;

input_identifier
    : input_atom COMMA input_identifier
    | input_atom
    ;

input_atom
    : nonarray_identifier
    | nonarray_identifier dimension_identifier
    ;


dimension_identifier
    : dimension_identifier LBRACKET dimension_identifier RBRACKET
    | LBRACKET dimension_identifier RBRACKET
    | IDENTIFIER
    | NUMBER
    ;

expr
	: assign_expr SEMICOLON expr
	| construct_expr expr
	| return_expr SEMICOLON expr
	|
	;
	
construct_expr
	: IF paren_cond_expr brace_expr
	| IF paren_cond_expr brace_expr ELSE brace_expr
	| WHILE paren_cond_expr brace_expr
	| DO brace_expr WHILE paren_cond_expr SEMICOLON
	| FOR LPAREN assign_expr SEMICOLON cond_expr SEMICOLON assign_expr RPAREN brace_expr
	;

brace_expr
    : LBRACE expr RBRACE
    ;

paren_cond_expr
    : LPAREN cond_expr RPAREN
    ;

cond_expr
	: paren_cond_expr
	| cond_expr AND cond_expr
	| cond_expr OR cond_expr
	| NOT cond_atom
	| cond_atom
	;

cond_atom
    : math_expr RELOP math_expr
	| math_expr RELOP NUMBER
	| NUMBER RELOP math_expr
	| NUMBER RELOP NUMBER
	| TRUE
	| FALSE
	;

return_expr
	: RETURN math_expr
	| RETURN cond_expr
	;
	
assign_expr
	: possiblearray_identifier ASSIGN math_expr
	;
	
math_expr
	: math_expr '+' math_expr
	| math_expr '*' math_expr
	| math_expr '-' math_expr
	| math_expr '/' math_expr
	| math_expr MOD math_expr
	| '-' math_expr %prec UMINUS
	| LPAREN math_expr RPAREN
	| NUMBER
	| possiblearray_identifier
	| math_func
	;

math_func
    : POW LPAREN math_expr COMMA math_expr RPAREN
    | DIV LPAREN math_expr COMMA math_expr RPAREN
    | ROOT LPAREN math_expr COMMA math_expr RPAREN
    | SQRT LPAREN math_expr RPAREN
    | FLOOR LPAREN math_expr RPAREN
    | CEIL LPAREN math_expr RPAREN
    | ABS LPAREN math_expr RPAREN
    | FACT LPAREN math_expr RPAREN
    | SIN LPAREN math_expr RPAREN
    | COS LPAREN math_expr RPAREN
    | TAN LPAREN math_expr RPAREN
    | COT LPAREN math_expr RPAREN
    | SEC LPAREN math_expr RPAREN
    | CSC LPAREN math_expr RPAREN
    | ARCSIN LPAREN math_expr RPAREN
    | ARCCOS LPAREN math_expr RPAREN
    | ARCTAN LPAREN math_expr RPAREN
    ;

nonarray_identifier
    : IDENTIFIER
    ;

possiblearray_identifier
    : IDENTIFIER array_brace_expr
    ;

array_brace_expr
    : LBRACKET math_expr RBRACKET array_brace_expr
    |
    ;