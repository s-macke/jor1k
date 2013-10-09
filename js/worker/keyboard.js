// -------------------------------------------------
// ------------------ KEYBOARD ---------------------
// -------------------------------------------------

// Emulating the Opencores Keyboard Controller

// translation table from Javascript keycodes to US-keyboard keycodes

var kc2kc =
[
// 0
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
14,     // backspace
15,     // tab

// 10
0,      //
0,      //
0,      //
28,     // enter
0,      //
0,      //
42,     // shift
29,     // ctrl
56,     // alt
197,    // pause/break

// 20
58,     // caps lock
0,      // 
0,      //
0,      //
0,      //
0,      //
0,      //
1,      // escape
0,      //
0,      //

// 30
0,      //
0,      //
57,     // space
201,    // page up
209,    // page down
207,    // end
199,    // home
203,    // left arrow
200,    // up arrow
205,    // right arrow

// 40
208,    // down arror
0,      //
0,      //
0,      //
0,      //
210,    // insert
211,    // delete
0,      //
11,     // 0
2,      // 1

// 50
3,      // 2
4,      // 3
5,      // 4
6,      // 5
7,      // 6
8,      // 7
9,      // 8
10,     // 9
0,      // 
0,      // 

// 60
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
30,     // a
48,     // b
46,     // c
32,     // d
18,     // e

// 70
33,     // f
34,     // g
35,     // h
23,     // i
36,     // j
37,     // k
38,     // l
50,     // m
49,     // n
24,     // o

// 80
25,     // p
16,     // q
19,     // r
31,     // s
20,     // t
22,     // u
47,     // v
17,     // w
45,     // x
21,     // y

// 90
44,     // z
219,    // left window key
220,    // right window key
183,    // select key
0,      // 
0,      // 
82,     // numpad 0
79,     // numpad 1
80,     // numpad 2
81,     // numpad 3

// 100
75,     // numpad 4
76,     // numpad 5
77,     // numpad 6
71,     // numpad 7
72,     // numpad 8
73,     // numpad 9
55,     // multiply
77,     // add
0,      // 
12,     // subtract

// 110
83,     // decimal point
181,    // divide
59,     // F1
60,     // F2
61,     // F3
62,     // F4
63,     // F5
64,     // F6
65,     // F7
66,     // F8

// 120
67,     // F9
68,     // F10
87,     // F11
88,     // F12
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //

// 130
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 140
0,      // 
0,      // 
0,      // 
0,      // 
69,     // num lock
70,     // scroll lock
0,      // 
0,      // 
0,      // 
0,      //

// 150
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 160
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 170
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 180
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
39,     // semi-colon
13,     // equal sign
51,     // comma
12,     // dash

// 190
52,     // period
53,     // forward slash
40,     // grave accent
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 200
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 210
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
26,     // open bracket

// 220
43,     // back slash
27,     // close bracket
40,     // single quote
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

];

function KeyboardDev(intdev) {
    this.intdev = intdev;
    this.Reset();    
    }

KeyboardDev.prototype.Reset = function() {
    this.key = 0x0;
}

KeyboardDev.prototype.OnKeyDown = function(event) {
    this.key = kc2kc[event.keyCode] | 0x0;
    if (this.key != 0) {
        this.intdev.RaiseInterrupt(0x5);
    }
}

KeyboardDev.prototype.OnKeyUp = function(event) {
    this.key = kc2kc[event.keyCode] | 0x80;
    if (this.key != 0) {
        this.intdev.RaiseInterrupt(0x5);
    }
}

KeyboardDev.prototype.ReadReg8 = function (addr) {
    this.intdev.ClearInterrupt(0x5);
    return this.key;
}

