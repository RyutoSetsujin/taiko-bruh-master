//Menu
let uracounter = 0
let mode = -1
let canSelect = true
/*
-1 = ready?
0 = title
1 = song select
2 = ingame
3 = results
*/
let selected = {
	song: 0,
	difficulty: -2,
	selection: "song",
	settings: {
		volume: 25,
		offset: 0,
		customBuffer: false,
		GAS: false,
		defaultGauge: "None",
		vsync: true,
		names: [
			"Volume (%)", "Chart Offset (ms)", "Audio-Ran Notes", "Default Gauge", "VSync", "Max FPS", "Max TPS", "Upload Custom Chart"
		],
		amounts: [
			25, 0, false, "None", true, 60, 240, ""
		],
		range: [
			[0, 100], [-1500, 1500], ()=>{selected.settings.customBuffer = !selected.settings.customBuffer}, ()=>{selected.settings.defaultGauge = gaugeNames[(gaugeNames.indexOf(selected.settings.defaultGauge)+1) % 7]}, ()=>{selected.settings.vsync = !selected.settings.vsync}, [1, 360], [1, 2880], ()=>{customChartUpload()}
		],
		descriptions: [
			"Sets the volume of the game in percentage.\n0% is the minimum, playing no sound, and 100% is the maximum.",
			"Sets the offset of the note chart in milliseconds.",
			"Enables notes to be moved based off the audio time, rather than\ngame time. This may cause a bit of lag in exchange for\nguaranteed sync.",
			"You can force a type of clear gauge.\nEasier, Easy, and Normal perform similarly to standard Taiko.\nHard, EXHard, and GAS perform similarly to BMS.\n\nIf \"None\" is selected, the gauge will be based off\nthe chosen difficulty.",
			"Defaults the FPS to your monitor's refresh rate.",
			"Sets the maximum FPS (Rendering) of the game, IF Vsync is off.",
			"Sets the maximum TPS (Internal FPS) of the game.",
			"You can locally upload a custom chart that you want to play.\nSelect two files, one for audio and one for sound.\nOtherwise, it won't work. (Recommended <15 MB)\n\nDue to the syntax of these charts, there is a\npossibility that it won't work as intended."
		]
	}
}


//Gameplay
var controls = ["d", "f", "j", "k"]


//Values of things
let difficulties = {
	names:  ["Easy",    "Normal",  "Hard",    "Extreme", "Extra"],
	colors: ["#FF0000", "#00FF00", "#0080FF", "#C000FF", "#0000FF"],
	gauges: ["Easier", "Easy", "Easy", "Normal", "Normal"],
	stars:  [8,         10,         12,         13,        13],
	hitwindow: [[0.042, 0.108, 0.125], [0.036, 0.097, 0.119], [0.030, 0.086, 0.113], [0.025, 0.075, 0.108], [0.025, 0.075, 0.108]]
}

let grades = {
	names: ["F",       "E-",      "E",       "E+",      "D-",      "D",       "D+",      "C-",      "C",       "C+",      "B-",      "B",       "B+",      "A-",      "A",       "A+",      "S-",      "S",       "S+",      "δ"],
   colors: ["#A00000", "#B30000", "#CC0000", "#E60000", "#FF0000", "#FF004D", "#FF00C3", "#CC00FF", "#2A00FF", "#004CFF", "#00AAFF", "#00FFFF", "#00FFD0", "#00FF5E", "#00FF0D", "#40FF00", "#80FF00", "#AAFF00", "#D4FF00", "#FFFF00", "#FFD500", "#FFAA00", "#FF8000", "#808080"],
   values: [0,         50,        52,        58,        60,        62,        68,        70,        72,        78,        80,        81.5,      88.5,      90,        91,        94,        95,        95.5,      99,        100,       100.2,     100.8,     101,       Infinity],
}

function gradeof(num = 100) {
	let a;
	for (let i = 0; i < grades.values.length; i++) {
		if (num >= grades.values[i] && num < grades.values[i+1]) {a = i; break;}
	}
	return {name: grades.names[a], color: grades.colors[a], values: grades.values[a]}
}


//Misc.
var res = [window.innerWidth, window.innerWidth / 2.010471204188482];
var cDate = new Date();
var timefunc = [{funct: () => {}, time: 0, executed: false}] //function, time, executed already
var debug = false
var debugval = [0, false]
let tipnum = Math.floor(Math.random() * tips.length)

Mousetrap.addKeycodes({
	144: 'numlock'
})

String.prototype.lengthWithJP = function () {
	return this.length + (this.replaceAll(/[!-~\s]/gm, "").length * 1.25)
}

let maxFPS = 60
let maxTPS = 240


//Setting the canvas resolution
ID("gameCanvas").width = res[0];
ID("gameCanvas").height = res[1];
cv.scale(res[0] / 1536, res[1] / 764);


console.log(`Hey, are you testing?\nDon't cheat!\n\nねぇ、 テストしていますか?\nずるしないでください。`);


//song stuff

let pfoffset = 0;
let songtime = 0
let songNotes = 0
//let clearGauge = [0, "Normal"]
let clearGauge = {
	easier: 0,
	easy: 0,
	normal: 0,
	hard: 100,
	exhard: 100,
	mode: "Normal",
	current: function () {return eval(`clearGauge.${clearGauge.mode.toLowerCase()}`)}
}
let gaugeNames = ["None", "Easier", "Easy", "Normal", "Hard", "EXHard", "GAS"]
let clearShow = false
let clearThresh = () => {return (clearGauge.mode == "Normal" ? 80 : (clearGauge.mode == "Easy" ? 72 : (clearGauge.mode == "Easier" ? 64 : 100)))}
let noteQueue = []
let rollQueue = []
let barQueue  = []
let renderQueue = []

function rrq(n = Infinity) {
	if (n == Infinity) {
		renderQueue = [...noteQueue].sort(function(a, b){return a.scroll*a.bpm - b.scroll*b.bpm})
	} else {
		renderQueue = []
		for (let i = 0; i < n && noteQueue[i] != undefined; i++) {
			renderQueue.push(noteQueue[i])
			renderQueue = [...renderQueue].sort(function(a, b){return a.scroll*a.bpm - b.scroll*b.bpm})
		}
	}
}

let currentSongData = {
	title: "",
	subtitle: "",
	wave: "",
	level: "1",
	nps: 0,
}

let ingameBPM = 120

let balloon = {at: 0, hits: 0, next: 1, hitQueue: []}
let eventQueue = []
let currentJudgement = ["", ""]
let hits = [0, 0, 0, 0, 0, 0] //good, ok, bad, rolls, combo, maxcombo
let hitting = []
let gogo = false
let songaudios = []
let sfxaudios = ["menu1", "menu2", "fail"]
let songbpms = []
let mshits = []

function sload() {
  for (let i = 0; i < songdata.length; i++) {
	  songaudios.push(new Audio(mdValue("WAVE", songdata[i])));
  }
  for (let i = 0; i < sfxaudios.length; i++) {
	  sfxaudios[i] = new Audio(`sfx/${sfxaudios[i]}.wav`);
  }
}

//other stuff
var bgDensity = 50
let bgElements = []
//color, time, x

var fps = [60, 60]
var fpsarr = [[], []]
for (let i = 0; i < 200; i++) {fpsarr[0].push(60); fpsarr[1].push(60);}


let initsomething = async () => {
		await new Promise(r => betterTimeout(r, 5500))
		songaudios[selected.song].currentTime = (7000 - Math.min(parseFloat(mdValue("OFFSET", songdata[selected.song]))*1000 + 5500, 5500))/1000
}

let fadetomode = async (m) => {
	canSelect = false
	let j = 0;
	for (j = 0; j < 255; j+=6) {
		await new Promise(r => betterTimeout(r, 8));
		ID("blackTop").style.backgroundColor = `#000000${j.toString(16)}`;
		for(i in songaudios) {songaudios[i].pause(); songaudios[i].volume = Math.max(((selected.settings.volume+1) - (1.1**j))/100, 0)}
		for(i in sfxaudios) {sfxaudios[i].volume = Math.max(((selected.settings.volume+1) - (1.1**j))/100, 0)}
	}
	await new Promise(r => betterTimeout(r, 250))
	mode = m;
	canSelect = true
	
	if (mode == 0) {
		selected.song = Math.floor(Math.random() * songdata.length)
		songaudios[selected.song].currentTime = 0;
		songaudios[selected.song].play();
	}
	
	if (mode == 1) {
		balloon.at = 0; balloon.next = 1; balloon.hits = 0; balloon.hitQueue = []; selected.selection = "song"; selected.difficulty = -2; clearGauge.easier = 0; clearGauge.easy = 0; clearGauge.normal = 0; clearGauge.hard = 100; clearGauge.exhard = 100; combo = 0; hits = [0, 0, 0, 0, 0, 0]; currentJudgement = ["", ""]; clearShow = false; mshits = []; gogo = false;
		
		//if (uracounter % 20 >= 10) {
			//let a = [difficulties.names[3], difficulties.colors[3]];	
  //[difficulties.names[3], difficulties.names[4]] = [difficulties.names[4], difficulties.names[3]];
  //[difficulties.colors[3], difficulties.colors[4]] = [difficulties.colors[4], difficulties.colors[3]];
		//}
				
		uracounter = 0;
		songaudios[selected.song].play();
		songaudios[selected.song].currentTime = isNaN(parseFloat(mdValue("DEMOSTART", songdata[selected.song]))) ? 0 : parseFloat(mdValue("DEMOSTART", songdata[selected.song]));
	}
	
	if (mode == 2) {
		for(i in songaudios) {songaudios[i].pause()}
		for(i in sfxaudios) {sfxaudios[i].pause()}
		timeStarted = performance.now();
		loadChart();
		currentSongData.title = mdValue("TITLE", songdata[selected.song])
		currentSongData.subtitle = mdValue("SUBTITLE", songdata[selected.song])
		let a = (selected.difficulty == 3 && hasCourse("4", songdata[selected.song]) && uracounter % 20 >= 10) ? 1 : 0
		let levelc = parseInt(mdValue("LEVEL", extractCourse(selected.difficulty+a, songdata[selected.song])));
		let hasplus = (!isNaN(parseInt(mdValue(`DIFPLUS${selected.difficulty+a}`, extractCourse(selected.difficulty+a, songdata[selected.song])))) || (mdValue("LEVEL", extractCourse(selected.difficulty+a, songdata[selected.song])) - levelc) >= 0.75)
		let hasminus = ((mdValue("LEVEL", extractCourse(selected.difficulty+a, songdata[selected.song])) - levelc) <= 0.25 && (mdValue("LEVEL", extractCourse(selected.difficulty+a, songdata[selected.song])) - levelc) != 0);
		currentSongData.level = `${parseInt(mdValue("LEVEL", extractCourse(selected.difficulty+a, songdata[selected.song])))}${hasplus ? "+" : (hasminus ? "-" : "")}`
	}
	
	for (j = 255; j > 0; j-=4) {
		await new Promise(r => betterTimeout(r, 8));
		ID("blackTop").style.backgroundColor = `#000000${j.toString(16)}`;
		if (mode < 2) {
			for(i in songaudios) {songaudios[i].volume = selected.settings.volume / 100}
			for(i in sfxaudios) {sfxaudios[i].volume = selected.settings.volume / 100}
		}
	}
	
}

let lastTime = [0, 0];

//draw on the canvas for the game
function update() {
cv.clear();

try {

for (let i = 0; i < bgElements.length; i++) {
	cv.circ(bgElements[i].color + "60", bgElements[i].x, 764 * (((performance.now() - bgElements[i].time) + (i*-1)*(20000/bgDensity))/12000), 30, false, [60, bgElements[i].color])
}
	cv.rect(`#${clearGauge.current() >= clearThresh() ? "FFFF00" : "000000"}${(clearGauge.mode.includes("Hard") && clearGauge.current() == 0) ? "60" : "1A"}`, 0, 0, 1536, 764)

switch (mode) {

case -1:
break;


//title
case 0:
cv.text("taiko bruh master", ["#FF0000", "#00FFFF"], 768, 275, "pixel", "90", "center");
cv.text(`press ${controls[1].toUpperCase()} / ${controls[2].toUpperCase()} to start!`, `#FFFFFF${numtobase(Math.floor(Math.abs(Math.sin((performance.now()-500) / 450)*100)) + 5, 16).padStart(2, "0")}`, 768, 400, "pixel", "65", "center");
cv.text(`(controls are ${(controls[0] + controls[1] + controls[2] + controls[3]).toUpperCase()}.)`, `#FFFFFFA0`, 768, 600, "pixel", "40", "center");

cv.text(tips[tipnum], ["#FF8080", "#80FFFF"], 768, 715, "pixel2", "35", "center")

cv.text("α.1.1:1\nhttps://discord.gg/2D2XbD77HD", "#DDDDDD50", 0, 30, "monospace", "25", "left");
break;



//song select
case 1:
	let dataOfSelected = selected.song != -1 ? songdata[selected.song] : ""
	
	cv.rect("#FFCC99", 30, (100 * (-1-selected.song)) + 320, 500, 80);
	if (selected.song != -1) cv.rect("#000000", 35, (100 * (-1-selected.song)) + 325, 490, 70);
	cv.text("Settings", (selected.song != -1 ? "#FFCC99" : "#000000"), 280, (100 * (-1-selected.song)) + 365, "pixel", "30", "center");

	for (let i = 0; i < songdata.length; i++) {
		levelF = parseFloat(mdValue("LEVEL", extractCourse(3, songdata[i])))
		levelS = parseFloat(mdValue("LEVEL", songdata[i]))
		cv.rect("#00C0FF", 30, (100 * (i-selected.song)) + 320, 500, 80);
		if (selected.song != i) cv.rect("#000000", 35, (100 * (i-selected.song)) + 325, 490, 70);
		cv.text(mdValue("DISPLAY", songdata[i]), (selected.song != i ? "#00C0FF" : "#000000"), 280, (100 * (i-selected.song)) + 365, "pixel", (mdValue("DISPLAY", songdata[i]).lengthWithJP() > 33 ? (29 * (33 / mdValue("DISPLAY", songdata[i]).lengthWithJP())).toString() : "30"), "center");
		cv.text(Math.floor(levelF) + `${(!isNaN(parseInt(mdValue("DIFPLUS3", songdata[i]))) || (levelF - Math.floor(levelF)) >= 0.75) ? "+" : (((levelF - Math.floor(levelF)) <= 0.25 && (levelF - Math.floor(levelF)) != 0) ? "-" : "")}`
		, (selected.song != i ? (songdata[i].includes("COURSE:4") ? difficulties.colors[4] : difficulties.colors[mdValue("COURSE", songdata[i])]) : "#000000"), 42, (100 * (i-selected.song)) + 388, "pixel2", "20", "left", false, [Math.max((levelS - 10)*7, 0), (selected.song != i ? "#00C0FF" : "#000000")]);
	}

	cv.rect("#00FFFF", 650, 20, 850, 724);
	cv.rect("#000000", 655, 25, 840, 714);
	if(selected.song != -1) {
		cv.text("Length: " + lengthOfTime(songaudios[selected.song].duration*1000), "#00C0C0", 665, 65, "pixel", "30", "left");
		cv.text(mdValue("MAKER", dataOfSelected) != "" ? `Charted by ${mdValue("MAKER", dataOfSelected)}` : `It's unknown who charted this.`, "#00B0B0", 1075, 350, "pixel", "30", "center");

		if (songbpms[selected.song].length > 1) cv.text(`${songbpms[selected.song][0]}-${songbpms[selected.song][songbpms[selected.song].length-1]} (${mdValue("BPM:", dataOfSelected)}) BPM`, "#00C0C0", 1485, 65, "pixel", "30", "right");
		else cv.text(`${mdValue("BPM:", dataOfSelected)} BPM`, "#00C0C0", 1485, 65, "pixel", "30", "right");

		cv.text(mdValue("GENRE", songdata[selected.song]), "#00FFFF", 1075, 120, "pixel", (mdValue("GENRE", songdata[selected.song]).length > 50 ? (25 * (20.5 / mdValue("GENRE", songdata[selected.song]).length)).toString() : "25"), "center");
		cv.text(mdValue("TITLE", dataOfSelected), "#00FFFF", 1075, 195, "pixel", (mdValue("TITLE", dataOfSelected).lengthWithJP() > 24 ? (69 * (24 / mdValue("TITLE", dataOfSelected).lengthWithJP())).toString() : "70"), "center");
		cv.text(mdValue("TITLEEN", songdata[selected.song]), "#00FFFF", 1075, 236, "pixel", (mdValue("TITLEEN", songdata[selected.song]).length > 50 ? (25 * (20.5 / mdValue("TITLEEN", songdata[selected.song]).length)).toString() : "25"), "center");
		cv.text(mdValue("SUBTITLE", songdata[selected.song]).slice(2), "#00FFFF", 1075, 275, "pixel", (mdValue("SUBTITLE", songdata[selected.song]).length > 35 ? (65 * (20.5 / mdValue("SUBTITLE", songdata[selected.song]).length)).toString() : "35"), "center");
		cv.text(mdValue("SOURCE", songdata[selected.song]), "#00FFFF", 1075, 303, "pixel", (mdValue("SOURCE", songdata[selected.song]).length > 50 ? (25 * (20.5 / mdValue("SOURCE", songdata[selected.song]).length)).toString() : "25"), "center");
	}

	cv.rect("#FFA000", 720, 580, 100, 100);
	if (selected.difficulty != -1) cv.rect("#000000", 725, 585, 90, 90);
	cv.text("Back", (selected.difficulty != -1 ? "#FFA000" : "#000000"), 770, 635, "pixel", "20", "center")
	

	if (selected.song != -1) {
		for (let i = 0; i < 4; i++) {
			if(i == 3 && hasCourse("4", dataOfSelected) && uracounter % 20 >= 10) i++;
			let extractCI = extractCourse(i, dataOfSelected)
			let levelc = parseInt(mdValue("LEVEL", extractCI));
			let levelf = parseFloat(mdValue("LEVEL", extractCI));
			if (isNaN(levelc)) continue;
			let hasplus = (!isNaN(parseInt(mdValue("DIFPLUS", extractCI))) || (levelf - levelc) >= 0.75)
			let hasminus = (levelf - levelc <= 0.25 && levelf - levelc != 0);
			//if(i==4)i=3;
			cv.rect(difficulties.colors[i], 720 + 180 * Math.min(i, 3), 400, 165, 165);
			if (selected.difficulty != Math.min(i, 3)) cv.rect("#000000", 725 + 180 * Math.min(i, 3), 405, 155, 155);
			cv.rect((selected.difficulty != Math.min(i, 3) ? (levelc > difficulties.stars[i] ? [difficulties.colors[i] + "50", difficulties.colors[i] + "A0"] : difficulties.colors[i] + "50") : (levelc > difficulties.stars[i] ? [difficulties.colors[i], `#FFFFFF${numtobase(Math.floor(Math.abs(Math.cos((performance.now()-500) / 800)*50)) + 100, 16).padStart(2, "0")}`, difficulties.colors[i]] : "#0000001A")), 720 + 180 * Math.min(i, 3), 565 - (165 * (levelc / difficulties.stars[i])), 165, (165 * (levelc / difficulties.stars[i])));
			cv.text(difficulties.names[i], (selected.difficulty != Math.min(i, 3) ? difficulties.colors[i] : "#000000"), 805 + 180*Math.min(i, 3), 450, "pixel", "40", "center", false, [Math.max((levelc - difficulties.stars[i])*7, 0), (selected.difficulty != i ? difficulties.colors[i] : "#000000")])
			cv.text(levelc, (selected.difficulty != Math.min(i, 3) ? difficulties.colors[i] : "#000000"), 805 + 180*Math.min(i, 3), 520, "pixel2", "60", "center", false, [Math.max((levelc - difficulties.stars[i])*7, 0), (selected.difficulty != i ? difficulties.colors[i] : "#000000")])
			if (hasplus) cv.text("+", (selected.difficulty != Math.min(i, 3) ? shadeColor(difficulties.colors[i], 50) : "#000000"), 835 + 180*Math.min(i, 3), 500, "pixel2", (i > 1 ? "33" : "22"), "center", false, [Math.max((levelc - difficulties.stars[i])*7, 0), (selected.difficulty != Math.min(i, 3) ? difficulties.colors[i] : "#000000")])
			else if (hasminus) cv.text("-", (selected.difficulty != Math.min(i, 3) ? shadeColor(difficulties.colors[i], 50) : "#000000"), 835 + 180*Math.min(i, 3), 500, "pixel", (i > 1 ? "33" : "22"), "center", false, [Math.max((levelc - difficulties.stars[i])*7, 0), (selected.difficulty != Math.min(i, 3) ? difficulties.colors[i] : "#000000")])
		}
	} else {
		for (let i = 0; i < selected.settings.names.length; i++) {
			let affectedI = i - Math.max(selected.difficulty, 0)
			if (affectedI >= -1 && affectedI < 6) {
			cv.rect("#FFCC99", 1200, 70 + 75 * affectedI, 120, 50);
			cv.text(selected.settings.names[i], "#FFCC99", 720, 103 + 75 * affectedI, "pixel", "30", "left")
			cv.text(selected.settings.amounts[i].toString().charAt(0).toUpperCase() + selected.settings.amounts[i].toString().slice(1), "#FFCC99", 1170, 103 + 75 * affectedI, "pixel", "30", "right")
			if (selected.difficulty != i) cv.rect("#000000", 1205, 75 + 75 * affectedI, 110, 40);
			cv.text(i == 7 ? "Upload" : "Change", selected.difficulty != i ? "#FFCC99" : "#000000", 1260, 103 + 75 * affectedI, "pixel", "30", "center")
			}
		}
		cv.rect("#00000080", 655, 0, 840, 50);
		cv.rect("#000000", 655, 0, 840, 25);
		cv.rect("#000000", 655, 470, 840, 25);
		cv.rect("#00000080", 655, 445, 840, 50);
		cv.text(selected.settings.descriptions[selected.difficulty] != undefined ? selected.settings.descriptions[selected.difficulty] : "", "#FFCC99", 1475, 520, "pixel", "25", "right")
	}

	cv.rect("#00000080", 0, 680, 1536, 1500)
	cv.text(tips[tipnum], ["#FF8080", "#80FFFF"], 768, 715, "pixel2", "35", "center")
break;


//game
case 2:
	cv.rect("#00000080", 0, 170, 2000, 170)
	cv.rect(gogo ? "#FFCCCC" : "#FFFFFF", 200, 180, 2000, 150)
	cv.rect(gogo ? "#661133" : "#111111", 205, 185, 2000, 140)
	cv.circ("#FFFFFFA0", 290, 253, 50, 3)
	cv.circ("#FFFFFFD0", 290, 253, 30, 5)
	
	cv.rect(clearGauge.mode == "EXHard" ? "#804000" : "#800000", 1536-1200, 158, clearThresh()*10, 22)
	if(clearGauge.mode != "Hard" && clearGauge.mode != "EXHard") cv.rect("#808000", 1536-(400 + ((80 - clearThresh())*10)), 147, (100-clearThresh())*10, 33)
	
	cv.rect(clearGauge.current() < 100 || clearGauge.mode.includes("Hard") ? (clearGauge.mode == "EXHard" ? "#FF8000" : "#FF0000") : `hsl(${Math.floor((performance.now()/11)%360)}, 100%, 50%)`, 1536-1200, 158, Math.min(Math.floor(clearGauge.current()), clearThresh())*10, 22)
	if(!clearGauge.mode.includes("Hard")) cv.rect(clearGauge.current() < 100 ? "#FFFF00" : `hsl(${Math.floor((performance.now()/11)%360)}, 100%, 50%)`, 1536-(400 + ((80 - clearThresh())*10)), 147, (Math.floor(clearGauge.current()) > clearThresh() ? Math.min(Math.floor(clearGauge.current() - clearThresh()), (100-clearThresh())) : 0)*10, 33)

	let colorn = ["", "#FF0000", "#00D0FF", "#FF1010", "#10E0FF", "#FFA000", "#FFA000", "#FF3010", "#00FF00"]
	let isbig = (t) => {return t == 3 || t == 4 || t == 6}
	
	rrq(100);

	for (i in barQueue) {
		cv.rect("#FFFFFF60", 288 + ((barQueue[i].time - barQueue[i].position()) * barQueue[i].bpm*barQueue[i].scroll*3.7), 185, 4, 140)
	}
	
	for (i in rollQueue) {
		//console.log(rollQueue)
		i = parseInt(i) //why do i need to do this??
		if (i % 2 == 0 && rollQueue[i+1] != undefined) {
		cv.rect(colorn[rollQueue[i].type], 290 + ((rollQueue[i].time - rollQueue[i].position()) * rollQueue[i].bpm*rollQueue[i].scroll*3.7), 253 - ((30 + (20*isbig(rollQueue[i].type)))), ((rollQueue[i+1].time - rollQueue[i].time) * rollQueue[i].bpm*rollQueue[i].scroll*3.7), (30 + (20*isbig(rollQueue[i].type))) * 2)
		cv.circ(colorn[rollQueue[i].type], 290 + ((rollQueue[i].time - rollQueue[i].position()) * rollQueue[i].bpm*rollQueue[i].scroll*3.7), 253, 30 + (20*isbig(rollQueue[i].type)));
		cv.circ(colorn[rollQueue[i].type], 290 + ((rollQueue[i+1].time - rollQueue[i+1].position()) * rollQueue[i].bpm*rollQueue[i].scroll*3.7), 253, 30 + (20*isbig(rollQueue[i].type)))
		}
	}
	


	for (i in renderQueue) {
		if (!renderQueue[i].hit) {
		cv.circ(colorn[renderQueue[i].type], 290 + ((renderQueue[i].time - renderQueue[i].position()) * renderQueue[i].bpm*renderQueue[i].scroll*3.7), 253, 30 + (20*isbig(renderQueue[i].type)))
		cv.circ("#FFFFFFDD", 290 + ((renderQueue[i].time - renderQueue[i].position()) * renderQueue[i].bpm*renderQueue[i].scroll*3.7), 253, 30 + (20*isbig(renderQueue[i].type)), 4 + (2*isbig(renderQueue[i].type)))
		
		//HB
		//cv.circ(colorn[renderQueue[i].type], 290 + ((renderQueue[i].time - renderQueue[i].position()) * ingameBPM*renderQueue[i].scroll*3.7), 253, 30 + (20*isbig(renderQueue[i].type)))
		//cv.circ("#FFFFFFDD", 290 + ((renderQueue[i].time - renderQueue[i].position()) * ingameBPM*renderQueue[i].scroll*3.7), 253, 30 + (20*isbig(renderQueue[i].type)), 4 + (2*isbig(renderQueue[i].type)))
		}
	}
	
	
	
	cv.text((balloon.at != 0 && balloon.hits != 0) ? balloon.hits : "", "#FFFFFF", 290, 150, "pixel", "45", "center")
	cv.text(currentJudgement[0], currentJudgement[1], 290, 220, "pixel", "40", "center")
	cv.text(currentSongData.title, "#FFFFFF", 1536, 50, "pixel", "50", "right")
	cv.text(`${difficulties.names[selected.difficulty + Math.floor(uracounter%20/10)]} ☆${currentSongData.level}`, difficulties.colors[selected.difficulty + Math.floor(uracounter%20/10)], 1536, 100, "pixel", "35", "right")
	cv.text("良", "#FFA000", 240, 420, "pixel", "35", "left")
	cv.text("可", "#80FFFF", 240, 455, "pixel", "35", "left")
	cv.text("不可", "#9000D0", 240, 490, "pixel", "35", "left")
	cv.text("連打", "#FFD040", 240, 525, "pixel", "35", "left")
	cv.text("コンボ", "#FF6000", 240, 560, "pixel", "35", "left")
	//cv.text(`${((mshits.reduce((sum, a) => sum + a, 0))/mshits.length).toFixed(2)}ms avg`, "#FFFFFF80", 700, 525, "pixel", "20", "center")
	//cv.text(`${JSON.stringify(clearGauge, false, "\n")}`, "#FFFFFF80", 700, 525, "pixel", "20", "left")
	//cv.text(`BPM ${ingameBPM}`, "#FFFFFF80", 700, 525, "pixel", "20", "left")
	cv.text((hits[4] > 0 ? hits[4] : ""), (hits[1] == 0 && hits[2] == 0 ? "#FFB080A0" : (hits[2] == 0 ? "#FFFFA0A0" : "#FFFFFFA0")), 180, 253, "pixel2", "45", "right")
	cv.text(`${hits[0]}\n${hits[1]}\n${hits[2]}\n${hits[3]}\n${hits[5]}`, "#FFFFFF", 400, 420, "pixel", "35", "right")
	cv.text(`${Math.round(((hits[0]*100 + hits[1]*50) / (hits[0]+hits[1]+hits[2])) * 100) / 100}%`, "#FFFFFF", 240, 600, "pixel", "35", "left")
	if(!isNaN((hits[0]*100 + hits[1]*50) / (hits[0]+hits[1]+hits[2]))) cv.text(`${gradeof((hits[0]*100 + hits[1]*50) / (hits[0]+hits[1]+hits[2])).name}`, gradeof((hits[0]*100 + hits[1]*50) / (hits[0]+hits[1]+hits[2])).color, 400, 600, "pixel", "35", "right")
	
	if (clearShow) {
		let ts = ["clear", "#FFFFFF"]
		
		if (hits[2] != 0) {
		if (clearGauge.mode != "Hard" && clearGauge.mode != "EXHard") {
			if (clearGauge.current() >= clearThresh()) {
				switch (clearGauge.mode) {
					case "Easier":
					ts = [`easy clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "CCFFCC" : "FFFFFF"}`]
					break;
					case "Easy":
					ts = [`easy clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "CCFFCC" : "FFFFFF"}`]
					break;
					case "Normal":
					ts = [`clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "CCFFCC" : "FFFFFF"}`]
					break;
				}
			} else ts = ["fail", "#A000E0"]
		} else {
			if (clearGauge.current() > 0) {
				switch (clearGauge.mode) {
					case "Hard":
					ts = [`hard clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "FF8080" : "FF0000"}`]
					break;
					case "EXHard":
					ts = [`exhard clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "FFB080" : "FF8000"}`]
					break;
				}
			} else ts = ["hard fail", "#FF4000"]
		}

	} else {
		if (hits[0] == 0) ts = ["wow you sure did \"okay\" alright", ["#00FFFF", "#FFFFFF"]]
		else if (hits[1] == 0) ts = ["DONDERFUL COMBO!!", ["#FF8080", "#FFC080", "#FFFF80", "#80FF80", "#80CFFF", "#8080FF", "#E080FF", "#FFFFFF", "#FFFFFF"]]
		else ts = ["FULL COMBO!", ["#FFFF00", "#FFFFA0"]]
	}
	cv.text(ts[0], ts[1], 1536/1.66, 265, "pixel", "60", "center")
	cv.text(clearGauge.mode.toUpperCase(), clearGauge.mode == "EXHard" ? "#FFB080" : (clearGauge.mode == "Hard" ? "#FF8080" : "#CCFFCC"), 1536/1.66, 305, "pixel2", "30", "center")
	}
	break;
	
	
	//result screen
	case 3:
	let accuracy = (hits[0]*100 + hits[1]*50) / (hits[0]+hits[1]+hits[2])
	
	cv.rect("#000000B0", 0, 0, 1536, 764)
	
	cv.text(currentSongData.title, "#FFFFFF", 768, 60, "pixel", "60", "center")
	cv.text(`${difficulties.names[selected.difficulty + Math.floor(uracounter%20/10)]} ☆${currentSongData.level}`, difficulties.colors[selected.difficulty + Math.floor(uracounter%20/10)], 768, 120, "pixel", "40", "center")
	
	cv.text(`${Math.round((accuracy) * 100) / 100}%`, "#FFFFFF", 500, 215, "pixel", "60", "right")
	cv.text("良", "#FFA000", 280, 270, "pixel", "50", "left")
	cv.text("可", "#80FFFF", 280, 320, "pixel", "50", "left")
	cv.text("不可", "#9000D0", 280, 370, "pixel", "50", "left")
	cv.text(`${hits[0]}\n${hits[1]}\n${hits[2]}`, "#FFFFFF", 500, 270, "pixel", "50", "right")
	
	cv.text(`${hits[3]}`, "#FFFFA0", 90, 270, "pixel", "35", "right")
	cv.text("連打", "#FFEE80", 115, 270, "pixel", "35", "left")
	cv.text(`${hits[5]}`, "#FFB080", 90, 310, "pixel", "35", "right")
	cv.text("コンボ", "#FF6000", 115, 310, "pixel", "35", "left")
	
	if(!isNaN(accuracy)) cv.text(`${gradeof(accuracy).name}`, gradeof(accuracy).color, 1150, 360, "pixel", "200", "center", false, [accuracy >= 99 ? 20 : 0, gradeof(accuracy).color])
	
	let dHW = [difficulties.hitwindow[selected.difficulty][0], difficulties.hitwindow[selected.difficulty][1], difficulties.hitwindow[selected.difficulty][2]]

	let graphStartX = 154
	let graphEndX = 1382
	let graphStartY = 550
	let graphEndY = 720
	
	cv.rect(clearGauge.mode == "EXHard" ? "#804000" : "#800000", graphEndX-1000, graphStartY - (graphEndY - graphStartY)*0.5 - 22, clearThresh()*10, 22)
	if(clearGauge.mode != "Hard" && clearGauge.mode != "EXHard") cv.rect("#808000", graphEndX-(200 + ((80 - clearThresh())*10)), graphStartY - (graphEndY - graphStartY)*0.5 - 33, (100-clearThresh())*10, 33)
	
	cv.rect(clearGauge.current() < 100 || clearGauge.mode.includes("Hard") ? (clearGauge.mode == "EXHard" ? "#FF8000" : "#FF0000") : `hsl(${Math.floor((performance.now()/11)%360)}, 100%, 50%)`, graphEndX-1000, graphStartY - (graphEndY - graphStartY)*0.5 - 22, Math.min(Math.floor(clearGauge.current()), clearThresh())*10, 22)
	if(!clearGauge.mode.includes("Hard")) cv.rect(clearGauge.current() < 100 ? "#FFFF00" : `hsl(${Math.floor((performance.now()/11)%360)}, 100%, 50%)`, graphEndX-(200 + ((80 - clearThresh())*10)), graphStartY - (graphEndY - graphStartY)*0.5 - 33, (Math.floor(clearGauge.current()) > clearThresh() ? Math.min(Math.floor(clearGauge.current() - clearThresh()), (100-clearThresh())) : 0)*10, 33)
	

	cv.rect("#FFFFFF", graphStartX, (graphStartY - ((graphEndY - graphStartY)*0.5)), (graphEndX - graphStartX), (graphEndY - graphStartY), 5)
	
	cv.text(`${dHW[2] * -1000}ms`, "#B0B0B0A0", graphStartX - 10, graphStartY + ((graphEndY - graphStartY)*-0.5) + 10, "pixel", "20", "right")
	cv.text(`${dHW[1] * -1000}ms`, "#B0B0B0A0", graphStartX - 10, graphStartY + ((graphEndY - graphStartY)*-(dHW[1] / dHW[2])*0.5) + 7.5, "pixel", "18", "right")
	cv.text(`${dHW[0] * -1000}ms`, "#B0B0B0A0", graphStartX - 10, graphStartY + ((graphEndY - graphStartY)*-(dHW[0] / dHW[2])*0.5) + 6, "pixel", "18", "right")
	cv.text(`0ms`, "#B0B0B080", graphStartX - 10, graphStartY + 5, "pixel", "20", "right")
	cv.text(`${dHW[0] * 1000}ms`, "#B0B0B0A0", graphStartX - 10, graphStartY + ((graphEndY - graphStartY)*(dHW[0] / dHW[2])*0.5) + 3, "pixel", "18", "right")
	cv.text(`${dHW[1] * 1000}ms`, "#B0B0B0A0", graphStartX - 10, graphStartY + ((graphEndY - graphStartY)*(dHW[1] / dHW[2])*0.5) + 1.5, "pixel", "18", "right")
	cv.text(`${dHW[2] * 1000}ms`, "#B0B0B0A0", graphStartX - 10, graphStartY + ((graphEndY - graphStartY)*0.5), "pixel", "20", "right")
	
	cv.rect("#59B0B080", graphStartX+2.5, graphStartY + ((graphEndY - graphStartY)*(dHW[1]*-1 / dHW[2])*0.5), (graphEndX - graphStartX)-5, (((graphEndY - graphStartY)*-(dHW[1] / dHW[2])*0.5) - ((graphEndY - graphStartY)*-(dHW[0] / dHW[2])*0.5)) * -1)
	cv.rect("#B06D0080", graphStartX+2.5, graphStartY + ((graphEndY - graphStartY)*(dHW[0]*-1 / dHW[2])*0.5), (graphEndX - graphStartX)-5, ((graphEndY - graphStartY)*-(dHW[0] / dHW[2])*0.5) * -1)
	cv.rect("#FFA00040", graphStartX+2.5, graphStartY - 1.5, (graphEndX - graphStartX)-10, 3)
	cv.rect("#B06D0080", graphStartX+2.5, graphStartY + ((graphEndY - graphStartY)*(dHW[0] / dHW[2])*0.5), (graphEndX - graphStartX)-5, ((graphEndY - graphStartY)*-(dHW[0] / dHW[2])*0.5))
	cv.rect("#59B0B080", graphStartX+2.5, graphStartY + ((graphEndY - graphStartY)*(dHW[1] / dHW[2])*0.5), (graphEndX - graphStartX)-5, ((graphEndY - graphStartY)*-(dHW[1] / dHW[2])*0.5) - ((graphEndY - graphStartY)*-(dHW[0] / dHW[2])*0.5))
	
	for (let i = 0; i < mshits.length; i++) {
		let colorJ;
		if (Math.abs(mshits[i][0]/1000) <= dHW[0]) colorJ = "#FFA000";
		else if (Math.abs(mshits[i][0]/1000) <= dHW[1]) colorJ = "#80FFFF";
		else colorJ = "#9000D0";
		
		cv.circ(colorJ, graphStartX + ((graphEndX - graphStartX) * ((mshits[i][1] - 4)/(mshits[mshits.length-1][1] - 4))) - 2.5, graphStartY + ((graphEndY - graphStartY) * (mshits[i][0]/1000 / (dHW[2]*2.05))), 3)
	}
	
	let ts = ["clear", "#FFFFFF"]
		
	if (hits[2] != 0) {
	if (clearGauge.mode != "Hard" && clearGauge.mode != "EXHard") {
		if (clearGauge.current() >= clearThresh()) {
			switch (clearGauge.mode) {
				case "Easier":
				ts = [`easy clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "CCFFCC" : "FFFFFF"}`]
				break;
				case "Easy":
				ts = [`easy clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "CCFFCC" : "FFFFFF"}`]
				break;
				case "Normal":
				ts = [`clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "CCFFCC" : "FFFFFF"}`]
				break;
			}
		} else ts = ["fail", "#A000E0"]
	} else {
		if (clearGauge.current() > 0) {
			switch (clearGauge.mode) {
				case "Hard":
				ts = [`hard clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "FF8080" : "FF0000"}`]
				break;
				case "EXHard":
				ts = [`exhard clear${clearGauge.current() == 100 ? "+" : ""}`, `#${clearGauge.current() == 100 ? "FFB080" : "FF8000"}`]
				break;
			}
		} else ts = ["hard fail", "#FF4000"]
	}
	} else {
		if (hits[0] == 0) ts = ["wow you sure did \"okay\" alright", ["#00FFFF", "#FFFFFF"]]
		else if (hits[1] == 0) ts = ["DONDERFUL COMBO!!", ["#FF8080", "#FFC080", "#FFFF80", "#80FF80", "#80CFFF", "#8080FF", "#E080FF", "#FFFFFF", "#FFFFFF"]]
		else ts = ["FULL COMBO!", ["#FFFF00", "#FFFFA0"]]
	}
	
	cv.text(ts[0], ts[1], 768, 265, "pixel", hits[1] == 0 && hits[2] == 0 ? "30" : "68", "center")
	cv.text(clearGauge.mode.toUpperCase(), clearGauge.mode == "EXHard" ? "#FFB080" : (clearGauge.mode == "Hard" ? "#FF8080" : "#CCFFCC"), 768, 334, "pixel2", "40", "center")
	
	break;
}

fps[0] = 1000/(performance.now() - lastTime[0])
lastTime[0] = performance.now()

fpsarr[0].push(fps[0])
fpsarr[0].shift();

cv.text(`${Math.round(fps[1])}(${((fpsarr[1].reduce((sum, a) => sum + a, 0))/fpsarr[1].length).toFixed(1)})tps\n${Math.round(fps[0])} (${((fpsarr[0].reduce((sum, a) => sum + a, 0))/fpsarr[0].length).toFixed(1)})fps`, "#FFFFFF60", 0, 764-45, "monospace", "20", "left")
cv.text(`${songtime.toFixed(3)} (${(4+songtime).toFixed(3)})\n${noteQueue[0] != undefined ? noteQueue[0].position().toFixed(3) + "\n" + ((noteQueue[0].position() - songtime + (pfoffset/1000))*1000).toFixed(2) + "ms" : ""}`, "#FFFFFF60", 1536, 764-45, "monospace", "20", "right")

	} catch (error) {
		cv.rect("#00000090", 0, 250, 1536, 100)
		cv.text(error.stack.toString(), "#FF8080", 1400, 300, "monospace", "15", "right")
		console.log(error.stack)
	}
	
if (selected.settings.vsync) window.requestAnimationFrame(update)
}



//updatePrec
function updatePrec() {
	try {
	if (songaudios[selected.song] != undefined) songtime = songaudios[selected.song].currentTime;

	if (timefunc[0] != undefined) {
		let tf_i = 0;
		for (tf_i = 0; tf_i < timefunc.length; tf_i++) {
			let currentfunc = timefunc[tf_i]
			if (performance.now() >= currentfunc.time && !currentfunc.executed) {
				currentfunc.funct();
				currentfunc.executed = true;
			} else break;
		}
		timefunc.splice(0, tf_i)
	}

	for (let i = 0; i < bgDensity; i++) {
		if (bgElements.length <= bgDensity) bgElements.push({color: shadeColor(randomColor(), 100), time: performance.now(), x: Math.floor(Math.random() * 1536) + 30})
			else {
				if (764 * (((performance.now() - bgElements[i].time) + (i*-1)*(20000/bgDensity))/12000) > 764+50) bgElements[i].time = performance.now();
			}
	}

	let rolltime = false
	let ib = 0;

	
	for (let i = 0; i < rollQueue.length; i++) {
		if (rollQueue[i].type == 7) ib++;
		if (i % 2 == 0 && rollQueue[i+1] != undefined) {
			if ((rollQueue[i].position() >= rollQueue[i].time) && (rollQueue[i].position() < rollQueue[i+1].time)) {
				rolltime = true; 
				if (balloon.at != ib && rollQueue[i].type == 7) {
					console.log(balloon.at, ib)
					balloon.at = ib;
					balloon.hits = balloon.hitQueue[balloon.at - 1];
				}
				break;
			} else if (balloon.at == ib) balloon.at = 0;
		}
	}

	if (noteQueue[0] != undefined) {
		while ((noteQueue[0].time - noteQueue[0].position()) <= (difficulties.hitwindow[selected.difficulty][2])*-1 && !noteQueue[0].hit) {
			mshits.push([difficulties.hitwindow[selected.difficulty][2]*1000, noteQueue[0].time]);
			noteQueue[0].hit = true;
			noteQueue.shift()
			currentJudgement = ["不可", "#9000D0"];
			hits[2]++;
			hits[4] = 0;
			clearGauge.easier -= (133.333 / songNotes);
			clearGauge.easy -= (133.333 / songNotes);
			clearGauge.normal -= (133.333 / songNotes);
			clearGauge.hard -= (10/3);
			clearGauge.exhard -= (10);
		}
	}

if (hitting[0] != undefined && mode == 2) {
	if (rolltime) {
		hits[3]++;
		if (balloon.at != 0) {
			if (balloon.hits > 0 && hitting[0] == 1) balloon.hits--;
			else hits[3]--;
		}
		hitting.shift();
		return;
	}
	let typecor = [[1, 3], [2, 4], [1, 3], [2, 4], [1], [1], [1], [1]]
	if (noteQueue[0] != undefined) {
	let precMS = Math.abs(noteQueue[0].time - noteQueue[0].position())
	if (typecor[noteQueue[0].type - 1].includes(hitting[0]) && precMS <= difficulties.hitwindow[selected.difficulty][2]) {
		mshits.push([(noteQueue[0].time - noteQueue[0].position()) * -1000, noteQueue[0].time])
		if(precMS <= difficulties.hitwindow[selected.difficulty][0]) {
			currentJudgement = ["良", "#FFA000"];
			hits[0]++;
			hits[4]++;
			clearGauge.easier += (177.777 / songNotes);
			clearGauge.easy += (155.555 / songNotes);
			clearGauge.normal += (133.333 / songNotes);
			if (clearGauge.hard != 0) clearGauge.hard += 0.075;
			if (clearGauge.exhard != 0) clearGauge.exhard += 0.05;
		}
		else if(precMS <= difficulties.hitwindow[selected.difficulty][1]) {
			currentJudgement = ["可", "#80FFFF"];
			hits[1]++;
			hits[4]++;
			clearGauge.easier += (88.888 / songNotes);
			clearGauge.easy += (77.777 / songNotes);
			clearGauge.normal += (66.666 / songNotes);
			if (clearGauge.hard != 0) clearGauge.hard += 0.0375;
			if (clearGauge.exhard != 0) clearGauge.exhard += 0.025;
		}
		else {
			currentJudgement = ["不可","#9000D0"];
			hits[2]++;
			hits[4] = 0;
			clearGauge.easier -= (133.333 / songNotes);
			clearGauge.easy -= (133.333 / songNotes);
			clearGauge.normal -= (133.333 / songNotes);
			clearGauge.hard -= (10/3);
			clearGauge.exhard -= 10;
		}
	noteQueue[0].hit = true;
	noteQueue.shift();
	}
	hitting.shift();
	}
}

clearGauge.easier = Math.min(Math.max(clearGauge.easier, 0), 100)
clearGauge.easy = Math.min(Math.max(clearGauge.easy, 0), 100)
clearGauge.normal = Math.min(Math.max(clearGauge.normal, 0), 100)
clearGauge.hard = Math.min(Math.max(clearGauge.hard, 0), clearGauge.hard <= 0 ? 0 : 100)
clearGauge.exhard = Math.min(Math.max(clearGauge.exhard, 0), clearGauge.exhard <= 0 ? 0 : 100)
//clearGauge.current() = Math.min(Math.max(clearGauge.current(), 0), ((clearGauge.mode == "Hard" || clearGauge.mode == "EXHard") && clearGauge.current() <= 0) ? 0 : 100)

if (selected.settings.GAS) {
	switch (clearGauge.mode) {
		case "EXHard":
			if (clearGauge.exhard == 0) clearGauge.mode = "Hard";
		break;
		
		case "Hard":
			if (clearGauge.hard == 0) clearGauge.mode = "Easier";
		break;

		case "Normal":
			if (clearGauge.normal < 80) clearGauge.mode = "Easy";
		break;
		
		case "Easy":
			if (clearGauge.easy < 72) clearGauge.mode = "Easier";
			if (clearGauge.normal >= 80) clearGauge.mode = "Normal";
		break;
		
		case "Easier":
			if (clearGauge.easy >= 72) clearGauge.mode = "Easy";
		break;
	}
}

if (hits[4] > hits[5]) hits[5] = hits[4]


fps[1] = 1000/(performance.now() - lastTime[1]);
lastTime[1] = performance.now();
fpsarr[1].push(fps[1] == Infinity ? 1000 : fps[1]);
fpsarr[1].shift();
	} catch (error) {
		cv.rect("#00000090", 0, 100, 1536, 100)
		cv.text(error.stack.toString(), "#FF8080", 1400, 150, "monospace", "15", "left")
		console.log(error.stack)
	}
}

class note{
	constructor(type, time, bpm, scroll, offset = 0) {
		this.type = type;
		this.time = time;
		this.started = timeStarted;
		this.songoffset = parseFloat(mdValue("OFFSET", songdata[selected.song]));
		this.position = () => {if ((songaudios[selected.song].currentTime <= 0 && songtime < songaudios[selected.song].duration) || !selected.settings.customBuffer) return (performance.now() - timeStarted)/1000; else return (songtime + this.songoffset + 4)};
		this.bpm = bpm;
		this.scroll = scroll;
		this.hit = false;
	}
}

/*
["良", "#FFA000"]
["可", "#80FFFF"]
["不可","#500090"]
*/

function loadChart(ret=false) {
	noteQueue = [];
	rollQueue = [];
	barQueue = [];
	let chartData = {
		fullData: songdata[selected.song],
		course: (selected.difficulty != 3 ? selected.difficulty : (uracounter % 20 < 10 ? 3 : 4)),
		bpm: parseFloat(mdValue("BPM:", songdata[selected.song])),
		offset: Math.max(0, parseFloat(mdValue("OFFSET", songdata[selected.song])))-(4-selected.settings.offset/1000),
		courseData: "pending",
		scroll: "pending",
		measure: "pending"
	}
	chartData.courseData = extractCourse(chartData.course, chartData.fullData, true).replaceAll("\n,\n", "\n0,\n").replaceAll(RegExp("(?:/\\*(?:[^*]|(?:\\*+[^*/]))*\\*+/)|(?://.*)", "g"),"");
	if (selected.settings.defaultGauge == "GAS") {
		selected.settings.GAS = true;
		clearGauge.mode = "EXHard";
	} else {
		selected.settings.GAS = false;
		if(selected.settings.defaultGauge == gaugeNames[0]) clearGauge.mode = difficulties.gauges[selected.difficulty]
		else clearGauge.mode = selected.settings.defaultGauge;
	}
	clearGauge.hard = 100; clearGauge.exhard = 100;
	console.log(chartData)
	chartData.scroll = 1
	chartData.measure = 4/4;
	if(ret) return chartData
	let currentBeat = 0
	let currentTrueBeat = 0
	let currentBPM = chartData.bpm
	let currentMeasure = chartData.measure
	let currentScroll = chartData.scroll
	if (mdValue("BALLOON", extractCourse(chartData.course, chartData.fullData, false)) != "") {
		balloon.hitQueue = JSON.parse(`[${mdValue("BALLOON", extractCourse(chartData.course, chartData.fullData, false)).replace(/,$/gm, "")}]`)
	}
	let barlines = true
	let datasplit = chartData.courseData.split("\n")
	let datasplitF = datasplit.filter(item => !(item.at(0) == "#"))
	let g = 0;
	
	for (let j = 0; j < datasplit.length; j++) {
		/*while (datasplit[j].at(0) == "#") {
			let ev = datasplit[j].slice(1, datasplit[j].length).split(" ")
			switch (ev[0]) {
				case "MEASURE":
					currentMeasure = Function("return " + ev[1])();
				break;
				case "SCROLL":
					currentScroll = parseFloat(ev[1]);
				break;
			}
			console.log(datasplit[j])
			datasplit.splice(j, 1)
		}*/
		//while (!datasplitF[j].includes(",") && datasplitF[j+1] != undefined) {console.log(datasplitF[j]); datasplitF[j] += datasplitF[j+1]; datasplitF.splice(j+1, 1); g++;}
		//let dll = (datasplitF[j] == ",") ? ["0"] : datasplitF[j].slice(0, datasplitF[j].indexOf(",")).split("");
		while (!datasplit[j].includes(",") && datasplit[j+1] != undefined) {datasplit[j] += `\n${datasplit[j+1]}`; datasplit.splice(j+1, 1)}
		let dll = datasplit[j].split(",")[0].split("");
		console.log(dll)
		dll = dll.join("").split("\n").filter(item => item != "")
		//console.log(dll)
		if (dll.length == 0) dll = ["0"]
		ndl = []
		for (k in dll) {
			if (dll[k].at(0) != "#") ndl.push(dll[k].split(""))
		}
		ndl = singleArray(ndl)
		if (ndl.length == 0) ndl = ["0"]
		console.log(ndl)
		
		for (k = 0; k < dll.length; k++) {
			//console.log(currentBeat)
			if (dll[k].at(0) == "#") {
				let ev = dll[k].split(" ")
				console.log(ev)
				switch (ev[0]) {
				case "#MEASURE":
					currentMeasure = Function("return " + ev[1])();
				break;
				case "#SCROLL":
					currentScroll = parseFloat(ev[1]);
				break;
				case "#BPMCHANGE":
					let pastBPM = currentBPM
					currentBPM = parseFloat(ev[1]);
					currentBeat = currentBeat * (currentBPM/pastBPM)
					console.log(pastBPM, currentBPM, currentBeat)
					let tempCurrentBPM = currentBPM
					betterTimeout(() => {ingameBPM = tempCurrentBPM}, ((60/currentBPM*(currentBeat*4))-chartData.offset) * 1000)
				break;
				case "#GOGOSTART":
					betterTimeout(() => {gogo = true}, ((60/currentBPM*(currentBeat*4))-chartData.offset) * 1000 + selected.settings.offset)
				break;
				case "#GOGOEND":
					betterTimeout(() => {gogo = false}, ((60/currentBPM*(currentBeat*4))-chartData.offset) * 1000 + selected.settings.offset)
				break;
				case "#BARLINEOFF":
					barlines = false
				break;
				case "#BARLINEON":
					barlines = true
				break;
			}
			} else {
				dll[k] = dll[k].split("")
				for (let l = 0; l < dll[k].length; l++) {
					if(dll[k][l] != "0") {
						if(dll[k][l] < 5 || dll[k][l] > 8) noteQueue.push(new note(dll[k][l], (60/currentBPM*(currentBeat*4))-chartData.offset, currentBPM, currentScroll, chartData.offset))
						else rollQueue.push(new note(dll[k][l], (60/currentBPM*(currentBeat*4))-chartData.offset, currentBPM, currentScroll, chartData.offset))
					}
					if(Math.abs(currentTrueBeat - Math.round(currentTrueBeat)) < 0.000001 && barlines) {
						barQueue.push(new note(0, (60/currentBPM*(currentBeat*4))-chartData.offset, currentBPM, currentScroll, chartData.offset))
					}
					//console.log((60/currentBPM*(currentBeat*4))-chartData.offset)
					console.log(currentBeat)
					currentBeat += ((1/ndl.length)*currentMeasure)
					currentTrueBeat += (1/ndl.length)
				}
			}
		}
	}
	songNotes = noteQueue.length;
	ingameBPM = chartData.bpm;
	rrq(100);
	betterTimeout(() => {clearShow = true; betterTimeout(() => {fadetomode(3)}, 5000)}, ((60/currentBPM*(currentBeat*4))-chartData.offset)*1000)
		//soundManager.setVolume(selected.settings.volume)
		for(i in songaudios) {songaudios[i].volume = selected.settings.volume/100}
		for(i in sfxaudios) {sfxaudios[i].volume = selected.settings.volume/100}
		songaudios[selected.song].currentTime = 0
		//songaudios[selected.song].play();
		songaudios[selected.song].volume = selected.settings.volume * 0.001
		pfoffset = parseFloat(mdValue("OFFSET", songdata[selected.song]))*1000
		betterTimeout(() => {
		if (pfoffset > 0) {
			console.log("1st con");
			betterTimeout(() => {songaudios[selected.song].play(); songaudios[selected.song].currentTime = 0; songaudios[selected.song].volume = selected.settings.volume/100}, pfoffset)
		} else {
			console.log("2nd con");
			songaudios[selected.song].currentTime = (Math.max(0, pfoffset*-1-4000))/1000;
			songaudios[selected.song].volume = selected.settings.volume/100;
			songaudios[selected.song].play();
		}
		}, Math.min(4000, 4000+pfoffset));
		betterTimeout(() => {if (noteQueue[0] != undefined && !selected.settings.customBuffer) songaudios[selected.song].currentTime = noteQueue[0].position() - pfoffset/1000 - 4}, Math.min(4000 + pfoffset, 4000));
}

function betterTimeout(func, ms) {
	if (typeof func != "function") console.warn("the first value needs to be a function")
	else {
		timefunc.push({funct: func, time: performance.now() + ms, executed: false});
		
		timefunc.sort(function(a, b) {
			return ((a.time < b.time) ? -1 : ((a.time == b.time) ? 0 : 1));
		});
	}
}

Mousetrap.bind(controls[0], function() {
	if (canSelect) {
		if (mode == 1) {
			switch(selected.selection) {
			case "song":
			if (selected.song > -1) {
				selected.song--;
				//soundManager.stopAll();
				for(i in songaudios) {songaudios[i].pause()}
				for(i in sfxaudios) {sfxaudios[i].pause()}
				sfxaudios[1].currentTime = 0;
				sfxaudios[1].play();
				if(selected.song != -1) {
				songaudios[selected.song].currentTime = parseFloat(mdValue("DEMOSTART", songdata[selected.song]));
				songaudios[selected.song].play();
				}
			}
			break;
			
			case "difficulty":
			sfxaudios[1].currentTime = 0;
			sfxaudios[1].play();
			if (selected.difficulty > -1) selected.difficulty--
			break;
			}
		}
		if (mode == 2) hitting.push(2)
	}
}, "keydown")

Mousetrap.bind([controls[1], controls[2]], function() {
	if (canSelect) {
		if (mode == 0) fadetomode(1)
		if (mode == 1) {
		sfxaudios[0].currentTime = 0;
		sfxaudios[0].play();
		switch(selected.selection) {
			case "song":
			selected.difficulty = 0
			selected.selection = "difficulty"
			break;
			
			case "difficulty":
			if(selected.difficulty > -1) {
				if(selected.song == -1) {
					let range = selected.settings.range[selected.difficulty]
					if(typeof range == "object") {
						let a = prompt(`Input a number between ${range[0]} and ${range[1]}.`)
						a = Math.max(Math.min(parseFloat(a), range[1]), range[0])
						if (!isNaN(a)) {
						selected.settings.amounts[selected.difficulty] = a;
						if (selected.difficulty == 0) {
							selected.settings.volume = a;
							for(i in songaudios) {songaudios[i].volume = selected.settings.volume/100}
							for(i in sfxaudios) {sfxaudios[i].volume = selected.settings.volume/100}
						};
						if (selected.difficulty == 1) selected.settings.offset = a;
						if (selected.difficulty == 5) {
							maxFPS = a
							if (!selected.settings.vsync) {
							clearInterval(frameInterval);
							frameInterval = setInterval(update, 1000/maxFPS);
							}
						}
						if (selected.difficulty == 6) {
							maxTPS = a;
							clearInterval(tickInterval);
							tickInterval = setInterval(updatePrec, 1000/maxTPS);
						}
						}
					} else {
						range();
						if (selected.difficulty == 2) selected.settings.amounts[2] = selected.settings.customBuffer;
						if (selected.difficulty == 3) selected.settings.amounts[3] = selected.settings.defaultGauge;
						if (selected.difficulty == 4) 
						if (selected.difficulty == 4) {
							selected.settings.amounts[4] = selected.settings.vsync;
							if (!selected.settings.vsync) {
								frameInterval = setInterval(update, 1000/maxFPS);
							} else {
								clearInterval(frameInterval);
								window.requestAnimationFrame(update);
							}
						}
						if (selected.difficulty == 5) selected.settings.amounts[6] = maxFPS;
						if (selected.difficulty == 6) selected.settings.amounts[6] = maxTPS;
					}
				} else fadetomode(2);
			}
			else {
				selected.selection = "song"; 
				selected.difficulty = -2;
				/*if (uracounter % 20 >= 10) {
				let a = [difficulties.names[3], difficulties.colors[3]];
				difficulties.names[3] = difficulties.names[4];
				difficulties.names[4] = a[0];
				difficulties.colors[3] = difficulties.colors[4];
				difficulties.colors[4] = a[1];
				}*/
				uracounter = 0
			}
			break;
		}
		}
		if (mode == 2) hitting.push(1);
		if (mode == 3) fadetomode(1);
	}
}, "keydown")

Mousetrap.bind(controls[3], function() {
	if (canSelect) {
		if (mode == 1) {
			switch(selected.selection) {
			case "song":
			if (selected.song < songdata.length-1) {
				selected.song++;
				//soundManager.stopAll();
				for(i in songaudios) {songaudios[i].pause()}
				for(i in sfxaudios) {sfxaudios[i].pause()}
				sfxaudios[1].currentTime = 0;
				sfxaudios[1].play();
				songaudios[selected.song].currentTime = parseFloat(mdValue("DEMOSTART", songdata[selected.song]));
				songaudios[selected.song].play();
			}
			break;
			
			case "difficulty":
			sfxaudios[1].currentTime = 0;
			sfxaudios[1].play();
			let limit = selected.song == -1 ? selected.settings.names.length-1 : 3
			if (selected.difficulty < limit) selected.difficulty++
			else {
			if (selected.song > -1) {
			if (hasCourse("4", songdata[selected.song])) uracounter++
			/*if (uracounter % 20 == 10 || uracounter % 20 == 0 && hasCourse("4", songdata[selected.song])) {
				let a = [difficulties.names[3], difficulties.colors[3]];
				difficulties.names[3] = difficulties.names[4];
				difficulties.names[4] = a[0];
				difficulties.colors[3] = difficulties.colors[4];
				difficulties.colors[4] = a[1];
			}*/
			}
			}
			break;
			}
		}
		if (mode == 2) hitting.push(2)
	}
}, "keydown")

Mousetrap.bind("shift+j+p", function() {convertLanguage("JP")})

Mousetrap.bind("shift+s+d", function() {
	if (canSelect && mode < 2) {
		//songdata.sort((a, b)=>{return parseFloat(mdValue("LEVEL", extractCourse(3, a))) - parseFloat(mdValue("LEVEL", extractCourse(3, b)))})
		let c = [];
		let level = function (data) {
			let temp = parseFloat(mdValue("LEVEL", extractCourse(3, data)))
			if (mdValue("DIFPLUS3", extractCourse(3, data)) != "") temp += 0.75;
			else {
				if (temp == Math.floor(temp)) temp += 0.5;
			}
			console.log(temp)
			return temp
		}
		for (let i = 0; i < songdata.length; i++) {c.push({'data': songdata[i], 'audio': songaudios[i]})}
		c.sort(function(a, b) {
			return ((level(a.data) < level(b.data)) ? -1 : ((level(a.data) == level(b.data)) ? 0 : 1));
		});
		for (let i = 0; i < c.length; i++) {
			songdata[i] = c[i].data;
			songaudios[i] = c[i].audio;
		}
	}
})

Mousetrap.bind("esc", function() {
	if (canSelect) {
	if (mode == 1) fadetomode(0)
	if (mode == 2 && noteQueue.length > 0) {
		while (noteQueue.length > 0) noteQueue.shift();
		while (timefunc.length > 0) timefunc.shift();
		fadetomode(1);
	}
	}
}, "keydown")

function customChartUpload() {
	alert("Select two files. One should be audio, and the other should be your tja file. Note that depending on the syntax of the tja, some charts may not work properly.");
	
	let fu = document.createElement('input');
	let file = {audio: 0, data: 0}
	fu.setAttribute("type", "file");
	fu.setAttribute("multiple", "");
	//fu.setAttribute("accept", "audio/*");
    fu.onchange = () => {
         file.audio = fu.files[0].type.startsWith("audio/") ? fu.files[0] : fu.files[1];
		 let reader = new FileReader();
		 reader.onload = function(e) {
			let srcUrl = e.target.result;
			//songaudios.push(soundManager.createSound({url: srcUrl, autoLoad: true, stream: true}));
			songaudios.push(new Audio(srcUrl))
			songaudios[songaudios.length - 1].volume = selected.settings.volume/100;
		 };
		 reader.readAsDataURL(file.audio);
		 
         file.data = fu.files[0].type.startsWith("audio/") ? fu.files[1] : fu.files[0];
		 
		 console.log(file.audio.type, file.data.type);
		 let reader2 = new FileReader();
		 reader2.onload = function(e) {
			console.log(e.target.result);
			songdata.push(e.target.result);
			songdata[songdata.length-1] = songdata[songdata.length-1].replaceAll("\r", "")
			songINIT();
			console.log(file.audio.type, file.data.type);
		 };
		 reader2.readAsText(file.data, 'utf-8');
		 
		 selected.settings.customBuffer = true; selected.settings.amounts[2] = true;
	};
	fu.click();
}

let frameInterval;
let tickInterval = setInterval(updatePrec, 1000/maxTPS)
setInterval(() => {tipnum = Math.floor(Math.random() * tips.length)}, 12500)



function songINIT() {
	songbpms = []
for (let i = 0; i < songdata.length; i++) {
	if(!songdata[i].startsWith("\n"))songdata[i] = `\n${songdata[i]}`
	songbpms.push([])
	songbpms[i].push(mdValue("BPM:", songdata[i]));
	songbpms[i].push(mdValue("#BPMCHANGE", songdata[i], 1, true))
	if (songbpms[i].length > 1) {
		//console.log(songbpms[i])
		songbpms[i] = singleArray([[songbpms[i][0]], songbpms[i][1]])
		songbpms[i] = songbpms[i].sort(function(a, b) {return parseFloat(a) - parseFloat(b)})
	}
	songdata[i] = songdata[i].replaceAll(RegExp("COURSE:Dan", "gmi"), "COURSE:6").replaceAll(RegExp("COURSE:Edit", "gmi"), "COURSE:4").replaceAll(RegExp("COURSE:Oni", "gmi"), "COURSE:3").replaceAll(RegExp("COURSE:Hard", "gmi"), "COURSE:2").replaceAll(RegExp("COURSE:Normal", "gmi"), "COURSE:1").replaceAll(RegExp("COURSE:Easy", "gmi"), "COURSE:0")
	songdata[i] = songdata[i].replaceAll(RegExp("(?:/\\*(?:[^*]|(?:\\*+[^*/]))*\\*+/)|(?://.*)", "gm"), "")
}
}

songINIT();


cv.text("click or press a key to load the game\nand have fun :D", "#FFFFFF", 768, 382, "monospace", "25", "center")

let activation = setInterval(() => {
if (navigator.userActivation != undefined) {
if (navigator.userActivation.isActive) {
	mode = 0;
	selected.song = Math.floor(Math.random() * songdata.length)
	betterTimeout(() => {
		for(i in songaudios) {songaudios[i].volume = selected.settings.volume/100}
		for(i in sfxaudios) {sfxaudios[i].volume = selected.settings.volume/100}
	songaudios[selected.song].play();
	}, 500)
	betterTimeout(() => {window.requestAnimationFrame(update)}, 500);
	clearInterval(activation);
}
} else {
	mode = 0;
	selected.song = Math.floor(Math.random() * songdata.length)
	betterTimeout(() => {
		for(i in songaudios) {songaudios[i].volume = selected.settings.volume/100}
		for(i in sfxaudios) {sfxaudios[i].volume = selected.settings.volume/100}
	songaudios[selected.song].play();
	}, 500)
	betterTimeout(() => {window.requestAnimationFrame(update)}, 500);
	clearInterval(activation);
}
}, 1)