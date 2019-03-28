function isPrime(n) {
    return ( n < 2 || ( n != 2 && n % 2 == 0))? 0 : F1( n,3);
}
function F1(n,i) {
    return ( i < Math.sqrt n))? ( n % i == 0)? 0 : F1( n,i + 2): 1;
}
