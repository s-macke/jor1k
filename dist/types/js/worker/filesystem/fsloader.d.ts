export default FSLoader;
declare function FSLoader(filesystem: any): void;
declare class FSLoader {
    constructor(filesystem: any);
    fs: any;
    HandleDirContents(list: any, parentid: any): void;
    OnJSONLoaded(fsxml: any): void;
    sysrootdir: any;
    LoadJSON(url: any): void;
}
//# sourceMappingURL=fsloader.d.ts.map