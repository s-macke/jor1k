#include "bzlib.h"
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <dirent.h>
#include <errno.h>
#include <string.h>


// compile with gcc patches/fs2xml.c -lbz2

struct inode
{
	char name[128];
	char src[128];
	char link[128];
	int mode;
	int type;
	int size;
	int uid;
	int gid;
	int parentid;
	char *data;
	int compressed;
	int load;
	unsigned int mtime;
};

struct inode *inodes;
int ninodes = 0;

char currentpackage[256];

struct __attribute__ ((__packed__)) posix_header
{                              /* byte offset */
  char name[100];               /*   0 */
  char mode[8];                 /* 100 */
  char uid[8];                  /* 108 */
  char gid[8];                  /* 116 */
  char size[12];                /* 124 */
  char mtime[12];               /* 136 */
  char chksum[8];               /* 148 */
  char typeflag;                /* 156 */
  char linkname[100];           /* 157 */
  char magic[6];                /* 257 */
  char version[2];              /* 263 */
  char uname[32];               /* 265 */
  char gname[32];               /* 297 */
  char devmajor[8];             /* 329 */
  char devminor[8];             /* 337 */
  char prefix[155];             /* 345 */
                                /* 500 */
};

char* GetFullPath(const char* root, int id)
{
	static char path[1024];
	char temp[1024];
	path[0] = 0;
	temp[0] = 0;
	while(id != -1)
	{
		strcpy(temp, path);
		sprintf(path, "/%s%s", inodes[id].name, temp);
		id = inodes[id].parentid;
	}
	strcpy(temp, path);
	sprintf(path, "%s%s", root, temp);
	return path;
}

char* GetFullPathNotHidden(const char* root, int id, int *hidden)
{
	static char path[1024];
	char temp[1024];
	path[0] = 0;
	temp[0] = 0;
	while(id != -1)
	{
		strcpy(temp, path);
		if (inodes[id].name[0] == '.') {
			sprintf(path, "/%s%s", &(inodes[id].name[1]), temp);
			*hidden = 1;
		} else
		if ((inodes[id].name[0] == '_') && (inodes[id].name[1] == '_')) {
			sprintf(path, "/%s%s", &(inodes[id].name[2]), temp);
			*hidden = 1;
		} else
		if (inodes[id].name[0] == '_') {
			sprintf(path, "/%s%s", &(inodes[id].name[1]), temp);
			*hidden = 1;
		} else
			sprintf(path, "/%s%s", inodes[id].name, temp);
		id = inodes[id].parentid;
	}
	strcpy(temp, path);
	sprintf(path, "%s%s", root, temp);
	return path;
}

int decompress(const char *filename, unsigned char *buf)
{
	BZFILE *BZ2fp_r = NULL;
	char name[256];
	sprintf(name, "%s", filename);
	BZ2fp_r = BZ2_bzopen(name, "rb");
	if (BZ2fp_r == NULL)
	{
		fprintf(stderr, "Error: Cannot open bz2 file\n");
		exit(1);
		return 0;
	}

	int len = BZ2_bzread(BZ2fp_r, buf, 60*1024*1024);
	BZ2_bzclose(BZ2fp_r);

	//printf("decompressed size: %i\n", len);
	return len;
}


int Split(char *name, char walk[12][128])
{
	int n = strlen(name);
	int p = 0;
	int pn = 0;
	int i = 0;
	if (name[0] == '/') i=1;
	if (name[0] == '.') i=2;


	for(; i<n; i++)
	{
		if (name[i] == '/') { walk[pn][p]=0; p=0; pn++; continue;}
		walk[pn][p] = name[i];
		p++;
	}
	walk[pn][p]=0;
	if (name[n-1] == '/') pn--;
	return pn+1;
}

int IsEmpty(int parentid)
{
	int i=0;
	for(i=0; i<ninodes; i++)
	{
		if (inodes[i].parentid == parentid) return 0;
	}
	return 1;
}

int SearchInode(char *name, int parentid)
{
	int i = 0;
//	printf("%s\n", name);
	for(i=0; i<ninodes; i++)
	{
		if (inodes[i].parentid != parentid) continue;
		if ( strcmp(name, inodes[i].name) != 0) continue;
		//printf("found equal %s %s at index %i of %i and parentid %i\n", name, inodes[i].name, i, ninodes, parentid);
		return i;
	}
	return -1;
}


void MergeFile(struct posix_header* ph)
{
	char walk[12][128];
	int n = Split(ph->name, walk);
	//printf("%i\n", n);
	int parentid = -1;
	int i = 0;

	for(i=0; i<n-1; i++)
	{
		int ret = SearchInode(walk[i], parentid);
		if (ret == -1) 
		{
			fprintf(stderr, "Error: Could not find inode. But it should be there. Walk position: %i\n", i);
			exit(1);
		}
		parentid = ret;
	}
	int ret = SearchInode(walk[n-1], parentid);

	if ((ret != -1) && (ph->typeflag != '5'))
	{
		fprintf(stderr, "Warning: File '%s' already exists with id = %i and name '%s'\n", 
		walk[n-1], ret, inodes[ret].name);
		//exit(1);
		return; // do not overwrite
	}

	if ((ret != -1) && (ph->typeflag == '5')) return; // file exists


	strncpy(inodes[ninodes].name, walk[n-1], 127);
	//strncpy(inodes[ninodes].src, currentpackage, 127);
	inodes[ninodes].src[0] = 0;
	strncpy(inodes[ninodes].link, ph->linkname, 100);
	inodes[ninodes].parentid = parentid;
	inodes[ninodes].size = strtol(ph->size, NULL, 8);
	inodes[ninodes].uid = strtol(ph->uid, NULL, 8);
	inodes[ninodes].gid = strtol(ph->gid, NULL, 8);
	inodes[ninodes].mtime = strtol(ph->mtime, NULL, 8);

	int mode = strtol(ph->mode, NULL, 8);

	if ((inodes[ninodes].uid != 0) && (inodes[ninodes].uid != 1000)) {
		inodes[ninodes].uid = 0;
		inodes[ninodes].gid = 0;
	}


	switch(ph->typeflag)
	{
		case '5':
			mode |= S_IFDIR;
		break;
		case '0':
			mode |= S_IFREG;
			char *p = (char*)ph;
			if (inodes[ninodes].size != 0)
			{
				inodes[ninodes].data = malloc(inodes[ninodes].size);
				memcpy(inodes[ninodes].data, p+512, inodes[ninodes].size);
			}
		break;
		case '1':
		case '2':
			mode |= S_IFLNK;
			if (ph->linkname[0] == 0)
			{
				fprintf(stderr, "Error: no link given\n");
				exit(1);
			}
			if (ph->typeflag == '1') {
		            strncpy(inodes[ninodes].link+1, ph->linkname, 100);
                            inodes[ninodes].link[0] = '/';
			}

			//printf("%s\n", ph->linkname);
		break;
		default:
			printf("Error:type %c unknown\n", ph->typeflag);
			exit(1);
		break;
	}
	inodes[ninodes].mode = mode;

	ninodes++;
}


void Untar(unsigned char *buf, int len)
{
	struct posix_header* ph;
	int p = 0;
	while(p < len)
	{
		ph = (struct posix_header*)&buf[p];
		//printf("%s\n", ph->magic);
		p += 0x200;
		if (strncmp(ph->magic, "ustar", 5) != 0)
		{
			//ph->magic[5] = 0;
			//printf("magic wrong: %s\n", ph->magic);
		}
		if (strncmp(ph->magic, "ustar", 5) != 0) continue;
		//int size = atoi(ph->size);
		int size = strtol(ph->size, NULL, 8);
		printf("%c %s %8i %s\n", ph->typeflag, ph->mode, size, ph->name);
		MergeFile(ph);

		if (size != 0) {
			p = p + size;
			// round up
			if (p & 511) {p = p & (~0x1FF); /*p += 0x200;*/}
		}
	}
}

void PrintIdent(FILE *fp, int sub)
{
	int i = 0;
	for(i=0; i<sub; i++)
	{
		fprintf(fp, "\t");
	}
}



void WalkXML(FILE *fp, int parentid, int sub)
{
	int i=0;
	for(i=0; i<ninodes; i++)
	{
		if (inodes[i].parentid != parentid) continue;
		if ((inodes[i].mode & S_IFMT) == S_IFDIR){

			PrintIdent(fp, sub);

			fprintf(fp, "<Dir name='%s' mode='%o'", inodes[i].name, inodes[i].mode);
			if (inodes[i].uid)
				fprintf(fp, " uid='%i'", inodes[i].uid);
			if (inodes[i].gid)
				fprintf(fp, " gid='%i'", inodes[i].gid);

			fprintf(fp, ">");
			if (!(IsEmpty(i)))
				fprintf(fp, "\n");
			WalkXML(fp, i, sub+1);

			if (!(IsEmpty(i))) PrintIdent(fp, sub);
			fprintf(fp, "</Dir>\n");
		} else
		if ((inodes[i].mode & S_IFMT) == S_IFREG){

			PrintIdent(fp, sub);

			fprintf(fp, "<File name='%s' mode='%o' size='%i'", inodes[i].name, inodes[i].mode, inodes[i].size);

			if (inodes[i].uid)
				fprintf(fp, " uid='%i'", inodes[i].uid);
			if (inodes[i].gid)
				fprintf(fp, " gid='%i'", inodes[i].gid);
			if (inodes[i].compressed)
				fprintf(fp, " compressed='1'");
			if (inodes[i].load)
				fprintf(fp, " load='1'");
			if (inodes[i].src[0] != 0)
				fprintf(fp, " src='%s'", inodes[i].src);
			fprintf(fp, "/>\n");

		} else
		if ((inodes[i].mode & S_IFMT) == S_IFLNK) {
			PrintIdent(fp, sub);
			fprintf(fp, "<Link name='%s' mode='%o' path='%s' />\n", inodes[i].name, inodes[i].mode, inodes[i].link);
		}
	}

}


void CreateXML()
{
	FILE *fp = fopen("fs.xml", "w");
	if (fp == NULL)
	{
		fprintf(stderr, "Error: Cannot create file fs.xml\n");
		exit(1);
	}
//	fprintf(fp, "<FS n=\"%i\">\n", ninodes);
	fprintf(fp, "<FS src='fs/'>\n", ninodes);
	WalkXML(fp, -1, 1);
	fprintf(fp, "</FS>\n");
	fclose(fp);
}


void WalkJSON(FILE *fp, int parentid, int sub)
{
	int i=0;

	int n=0;

	for(i=0; i<ninodes; i++)
	{
		if (inodes[i].parentid != parentid) continue;
		n++;
	}

	for(i=0; i<ninodes; i++)
	{
		if (inodes[i].parentid != parentid) continue;
		n--;
		if ((inodes[i].mode & S_IFMT) == S_IFDIR) {

			PrintIdent(fp, sub);

			fprintf(fp, "{ \"name\":\"%s\", \"mode\":\"%o\"", inodes[i].name, inodes[i].mode);
			if (inodes[i].uid)
				fprintf(fp, ", \"uid\":%i", inodes[i].uid);
			if (inodes[i].gid)
				fprintf(fp, ", \"gid\":%i", inodes[i].gid);

			if (IsEmpty(i)) {
				fprintf(fp, ", \"child\":[] }");
			} else {
				fprintf(fp, ", \"child\":[\n");
				WalkJSON(fp, i, sub+1);
				PrintIdent(fp, sub);
				fprintf(fp, "]}");
			}
		}
		else
		if ((inodes[i].mode & S_IFMT) == S_IFREG){

			PrintIdent(fp, sub);

			fprintf(fp, "{ \"name\":\"%s\", \"mode\":\"%o\", \"size\":%i", inodes[i].name, inodes[i].mode, inodes[i].size);

			if (inodes[i].uid)
				fprintf(fp, ", \"uid\":%i", inodes[i].uid);
			if (inodes[i].gid)
				fprintf(fp, ", \"gid\":%i", inodes[i].gid);
			if (inodes[i].compressed)
				fprintf(fp, ", \"c\":1");
			if (inodes[i].load)
				fprintf(fp, ", \"load\":1");
			if (inodes[i].src[0] != 0)
				fprintf(fp, ", \"src\":\"%s\"", inodes[i].src);
			fprintf(fp, "}");

		} else
		if ((inodes[i].mode & S_IFMT) == S_IFLNK) {
			PrintIdent(fp, sub);
			fprintf(fp, "{ \"name\":\"%s\", \"mode\":\"%o\", \"path\":\"%s\"}", inodes[i].name, inodes[i].mode, inodes[i].link);
		} else
		{
			printf("Unknown file typ\n");
			exit(1);
		}
		if (n == 0) fprintf(fp, "\n"); else fprintf(fp, ",\n");

	}

}


void CreateJSON()
{
	FILE *fp = fopen("fs.json", "w");
	if (fp == NULL)
	{
		fprintf(stderr, "Error: Cannot create file fs.json\n");
		exit(1);
	}
	fprintf(fp, "{");
	fprintf(fp, "\"src\":\"fs/\", ");
	fprintf(fp, "\"fs\":[\n", ninodes);
	WalkJSON(fp, -1, 1);
	fprintf(fp, "]}\n");
	fclose(fp);
}



int ShouldBeLoaded(char *name)
{
	if (strcmp(name, "libc.so") == 0) return 1;
	if (strcmp(name, "libncurses.so.5.9") == 0) return 1;
	if (strcmp(name, "libmenu.so.5.9") == 0) return 1;
	if (strcmp(name, "libgcc_s.so.1") == 0) return 1;
	return 0;
}

int EndsWith(const char *str, const char *suffix)
{
    if (!str || !suffix)
        return 0;
    size_t lenstr = strlen(str);
    size_t lensuffix = strlen(suffix);
    if (lensuffix > lenstr)
        return 0;
    return strncmp(str + lenstr - lensuffix, suffix, lensuffix) == 0;
}

int ShouldBeCompressed(char *name, char *data, int size)
{
	if (size < 4) return 0;

	int len = strlen(name);

        if (EndsWith(name, ".jpg")) return 0;
        if (EndsWith(name, ".png")) return 0;
        if (EndsWith(name, ".gz"))  return 0;
        if (EndsWith(name, ".bz2")) return 0;
        if (EndsWith(name, ".zip")) return 0;
        if (EndsWith(name, ".png")) return 0;
        if (EndsWith(name, ".3gp")) return 0;
        if (EndsWith(name, ".mpg")) return 0;

	if (size > 10*1024) return 1;

	if (data[0] == 0x7F)
	if (data[1] == 'E')
	if (data[2] == 'L')
	if (data[3] == 'F')
	{
		//printf("found binary\n");
		return 1;
	}
	return 0;
}

void RemoveFirstSignofString(char *s)
{
	int n = strlen(s);
	int i;
	for(i=0; i<n; i++)
	{
		s[i] = s[i+1];
	}
}

void AddFirstSigntoString(char *s, char x)
{
	int n = strlen(s);
	int i;
	for(i=n; i>=0; i--)
	{
		s[i+1] = s[i];
	}
	s[0] = x;
}

void WalkDir(int parentid)
{
	char *path;
	int hidden = 0;
	path = GetFullPathNotHidden("fs", parentid, &hidden);
	//printf("mkdir %s\n", path);
	mkdir(path, 0777);
	int i = 0;
	for(i=0; i<ninodes; i++)
	{
		if (inodes[i].parentid != parentid) continue;
		if ((inodes[i].mode & S_IFMT) == S_IFDIR)
		{
			WalkDir(i);
		}
		if ((inodes[i].mode & S_IFMT) == S_IFREG)
		{
			hidden = 0;
			path = GetFullPathNotHidden("fs", i, &hidden);
			if (hidden) {
				strcpy(inodes[i].src, &path[3]);
				//printf("hidden file: %s src: %s path: %s\n", inodes[i].name, inodes[i].src, path);
			}
			FILE *fp = fopen(path, "wb");
			if (fp == NULL) {
				printf("Error: Cannot create file %s\n", path);
				exit(1);
			}
			//printf("%s\n", inodes[i].name);
			if (inodes[i].size != 0)
				fwrite(inodes[i].data, inodes[i].size, 1, fp);
			fclose(fp);
			if (ShouldBeCompressed(inodes[i].name, inodes[i].data, inodes[i].size))
			{
				inodes[i].compressed = 1;
				char command[1024];
				sprintf(command, "bzip2 -f \"%s\"\n", path);
				//sprintf(command, "xz -e -f %s\n", path);
				//sprintf(command, "lzma -f %s\n", path);
				system(command);
				/*
				sprintf(command, "lz4 -9 -f \"%s\"\n", path);
				system(command);
				sprintf(command, "rm -f %s\n", path);
				system(command);
				*/

				
			}
			if (ShouldBeLoaded(inodes[i].name)) {
                             inodes[i].load = 1;
                        }

		}
	}
}

void CreateFilesystem()
{
	WalkDir(-1);
}


int main(int argc, char *argv[])
{
	unsigned char *buf = (unsigned char*)malloc(60 * 1024 * 1024);

	if (argc < 2)
	{
		printf("Usage: %s [list of .tar.bz2 files]\n", argv[0]);
		return 1;
	}
	printf("Build sysroot in folder %s\n", "fs");

	inodes = (struct inode*) malloc(10000 * sizeof(struct inode));
	memset(inodes, 0, 10000 * sizeof(struct inode));

	int i=0;
	char filename[256];
	for(i=1; i<argc; i++)
	{
		printf("decompress: %s\n", argv[i]);
		int len = decompress(argv[i], buf);
		Untar(buf, len);
	}

	fprintf(stderr, "number of inodes: %i\n", ninodes);
	int n=0;
	int size = 0;
	for(i=0; i<ninodes; i++)
	{
		if ((inodes[i].mode&S_IFMT) != S_IFREG) continue;
		n++;
		size += inodes[i].size;
	}
	fprintf(stderr, "number of files: %i with %f MB\n", n, (double)size/1024./1024.);

	CreateFilesystem();

	fprintf(stderr, "Generate XML\n");
	CreateXML();
	fprintf(stderr, "Generate JSON\n");
	CreateJSON();

	return 0;
}
