export default bzip2;
declare namespace bzip2 {
    let crcTable: number[];
    function array(bytes: any): (n: any) => number;
    function IsBZIP2(buffer: any): boolean;
    function simple(srcbuffer: any, stream: any): void;
    function header(bits: any): number;
    function decompress(bits: any, stream: any, buf: any, bufsize: any): boolean;
}
//# sourceMappingURL=bzip2.d.ts.map