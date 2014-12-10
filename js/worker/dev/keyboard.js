// -------------------------------------------------
// ------------------ KEYBOARD ---------------------
// -------------------------------------------------
// Emulating the Opencores Keyboard Controller

"use strict";
var message = require('../messagehandler');

// translation table from Javascript keycodes to Linux keyboard scancodes
// http://lxr.free-electrons.com/source/include/dt-bindings/input/input.h

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
119,    // pause/break

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
104,    // page up
109,    // page down
107,    // end
102,    // home
105,    // left arrow
103,    // up arrow
106,    // right arrow

// 40
108,    // down arrow
0,      //
0,      //
0,      //
0,      //
110,    // insert
111,    // delete
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
39,      // semi colon

// 60
,      // equal sign
13,      // 
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
0,    // left window key
0,    // right window key
0,    // select key
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
12,     // minus
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
    message.Register("keydown", this.OnKeyDown.bind(this) );
    message.Register("keyup", this.OnKeyUp.bind(this) );
    this.Reset();
}

KeyboardDev.prototype.Reset = function() {
    this.key = 0x0;
    this.fifo = [];
}

KeyboardDev.prototype.OnKeyDown = function(event) {
    this.key = kc2kc[event.keyCode] | 0x0;
    if (this.key == 0) return;
    this.fifo.push(this.key);
    this.intdev.RaiseInterrupt(0x5);
}

KeyboardDev.prototype.OnKeyUp = function(event) {
    this.key = kc2kc[event.keyCode];
    if (this.key == 0) return;
    this.key = this.key | 0x80;
    this.fifo.push(this.key);
    this.intdev.RaiseInterrupt(0x5);
}

KeyboardDev.prototype.ReadReg8 = function (addr) {
    var key = this.fifo.shift();
    if (this.fifo.length == 0) this.intdev.ClearInterrupt(0x5);
    return key;
}

module.exports = KeyboardDev;
