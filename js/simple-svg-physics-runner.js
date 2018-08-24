/*
simple-svg-physics-runner

2018.08.24, v.1.0.1

* Copyright(c) 2018 Hiroyuki Sato
  https://github.com/shspage/simple-svg-physics-runner
  This software is distributed under the MIT License.
  See the LICENSE.txt for details.
  
  This software uses the following libraries that may have licenses
  differing from that of the software itself. You can find the
  libraries and their respective licenses below.
-------------------------------------------
required libraries (and the version tested with)
* jQuery (v1.11.0)
  License MIT
  (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license

* matter-js (0.14.2) http://brm.io/matter-js/
  License MIT
  Copyright (c) Liam Brummitt and contributors.

* Paper.js (v0.11.5)  http://paperjs.org/
  License MIT
  Copyright (c) 2011 - 2016, Juerg Lehni & Jonathan Puckey
  http://scratchdisk.com/ & http://jonathanpuckey.com/

* poly-decomp.js (https://github.com/schteppe/poly-decomp.js)
  License MIT
  Copyright (c) 2013 Stefan Hedman

 */

(function () {
    'use strict';
    const EXPORT_SVG_FILENAME = "output.svg";
    const CANVAS_BACKGROUND_COLOR = "#fafafa";
    const BODY_DENSITY = 0.12;  // default=0.001
    const FRICTIONAIR_DEFAULT = 0.01;  // 空気抵抗の既定値
    const FRICTIONAIR_HIGH = 0.8;      // 空気抵抗=重い の値

    // Matter.Engine properties
    // * The higher the value, the higher quality the simulation will be at the expense of performance.
    // * 各値を増やすことでパフォーマンスと引き換えにシミュレーションの品質を上げることができる。
    //   各値がどのように影響するかは、Demo頁の右から引き出せるスライダ群を操作してみると手掛かりになるかも。
    const ENGINE_POSITION_ITERATIONS = 12;  // positionIterations, default=6
    const ENGINE_VELOCITY_ITERATIONS = 4;  // velocityIterations, default=4
    const ENGINE_CONSTRAINT_ITERATIONS = 2;  // constraintIterations, default=2
      
    paper.setup("hidden_canvas");
    
    var Body = Matter.Body,
        Bodies = Matter.Bodies,
        Vertices = Matter.Vertices,
        Mouse = Matter.Mouse,
        MouseConstraint = Matter.MouseConstraint,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Composite = Matter.Composite,
        Engine = Matter.Engine,
        World = Matter.World;

    var _spec = {
        url:null,
        isPause:false,
        wireframes: false,
        gravity_y:1,
        frictionAir:FRICTIONAIR_DEFAULT
    }

    // * Ratio to consider pass as circle (Larger ÷ Smaller)
    //   bounds: width to height ratio
    //   length, area : ratio between "the perimeter and area calculated using
    //       the width as diameter" and "actual value"
    // * パスを円と見なす比率（大きい方÷小さい方）
    //   bounds: 幅と高さの比率
    //   perimeter, area : 幅を直径として算出した円の周長・面積と、実際の値との比率
    var _circleRatioLimit = {
        bounds : 1.02,
        perimeter : 1.05,
        area : 1.02
    }
    
    var _messages;

    var _engine;
    var _runner;
    var _render;

    // paper.jsのPathの属性を保持・復旧する
    var SavedStyle = function(path){
        this.style = path.style;
        this.opacity = path.opacity;
        // blendModeはIllustratorではSVGに反映されない
        this.blendMode = path.blendMode;
    }
    SavedStyle.prototype = {
        apply : function(path){
            path.style = this.style;
            path.opacity = this.opacity;
            path.blendMode = this.blendMode;
        }
    }
    var _styles = {};

    function setupWorld(items){
        _engine = Engine.create({
            positionIterations: ENGINE_POSITION_ITERATIONS,
            velocityIterations : ENGINE_VELOCITY_ITERATIONS,
            constraintIterations : ENGINE_CONSTRAINT_ITERATIONS
        });
        _engine.world.gravity.y = _spec.gravity_y;

        _render = Render.create({
            element: document.body,
            engine: _engine,
            options: {
                background: CANVAS_BACKGROUND_COLOR,
                width: window.innerWidth, 
                height: window.innerHeight,
                showVelocity: false,
                wireframes: _spec.wireframes
            }
        });
        
        Render.run(_render);

        _runner = Runner.create();
        Runner.run(_runner, _engine);

        var mouse = Mouse.create(_render.canvas),
        mouseConstraint = MouseConstraint.create(_engine, {
            element: document.body,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                  }
            }
        });

        World.add(_engine.world, mouseConstraint);
        World.add(_engine.world, items);
        
        _render.mouse = mouse;
    
        Render.lookAt(_render, {
            min: { x: 0, y: 0 },
            max: { x: window.innerWidth, y: window.innerHeight }
        });
    }
    
    // ----------------------
    // functions to load data
    // ----------------------
    function checkLoaded(){
        if(_engine){
            alert(getMessage("already_loaded"));
            return true;
        }
        return false;
    }

    // drag and drop
    function handleFileSelect(evt){
        evt.stopPropagation();
        evt.preventDefault();
        if(checkLoaded()) return;
        
        var files = evt.dataTransfer.files;
        if(files.length > 0){
            var fileobj = files[0];
            var type = fileobj.type;
            if(type == "image/svg+xml"){
                var fr = new FileReader();
                fr.onload = function(e){
                    importSVG_paper(e.target.result);
                }
                fr.readAsText(fileobj, "utf-8");
            } else {
                if(type == "") type = "(unknown)";
                alert(getMessage("please_select_a_svg") + type + ").");
            }
        }
    }
    
    function handleDragOver(evt){
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = "copy";
    }
    
    // chrome 版。firefoxは追って対応かも（textareaを介して読み込む形になる）
    function importSVGFromClipboard_paper(){
        if(checkLoaded()) return;
        if(navigator.clipboard){
            navigator.clipboard.readText()
              .then((data) => importSVG_paper(data))
                .catch((e) => alert(getMessage("paste_failed")));
        } else {
            alert(getMessage("paste_chrome_only_for_now"));
        }
    }

    function importSVG_paper(data){
        try{
            paper.project.view.viewSize = new paper.Size(
                window.innerWidth, window.innerHeight);
            
            paper.project.importSVG(data);
            fixTopLeftAfterImport();
            paper2matter();
            
            alert("LOADED");
        } catch(e){
            alert(e);
        }
    }

    function fixTopLeftAfterImport(){
        var items = paper.project.activeLayer.children;
        
        if(items.length > 0){
            var top = items[0].bounds.top;
            var left = items[0].bounds.left;
            
            for(var i = 1, iEnd = items.length; i < iEnd; i++){
                top = Math.min(top, items[i].bounds.top);
                left = Math.min(left, items[i].bounds.left);
            }
            
            if(top != 0 || left != 0){
                var delta = new paper.Point(-left, -top);
                for(var i = 0, iEnd = items.length; i < iEnd; i++){
                    items[i].translate(delta);
                }
            }
        }
    }

    // ----------------------
    // functions to convert data, from paper.js to Matter.js
    // ----------------------
    // * Load SVG data from clipboard or file. Using "importSVG" of paper.js.
    //   Matter.js also has SVG import method, but I couldn't find a sample
    //   code to get color of each shape in SVG data. Since there may be
    //   various format in SVG data, I thought that it is easier to handle
    //   by putting it in the paper.js class rather than writing the analyzing
    //   process by myself.  For this reason, at here, the Paths loaded with
    //   paper.js are converted to Body object of Matter.js.
    // * クリップボードまたはファイルからのSVGデータ取り込み。
    //   paper.js の importSVG で行う。Matter.js にも SVG 取り込みの
    //   メソッドはあるが、サンプルコードにあるのは形状を取り込む処理
    //   だけで、色を取得する処理がない。SVG のデータも色々なものが
    //   あるので、自力で解析する処理を書くより、paper.js のクラスに
    //   落とし込んだほうが扱いやすいと考えた。
    //   このためここでは、paper.js で取り込んだ Path を Matter.js の
    //   Body に変換する処理をしている。
    
    function paper2matter(){
        var items = [];
        extractItems(paper.project.activeLayer.children, items);
        paper.project.clear();
        setupWorld(items);
    }

    function extractItems(children, items){
        for(var i = children.length - 1; i >= 0; i--){
            var c = children[i];
            if(c.className == 'Group' || c.className == 'Layer'){
                extractItems(c.children, items);
            } else if(c.clipMask){
                c.remove();
            } else if(c.className == "Shape" || c.className == "Path"){
                var body;
                if(c.shape == "rectangle"){
                    body = createRectangle(c);
                } else if(c.shape == "circle" || isCircle(c)){
                    body = createCircle(c);
                } else {
                    if(!c.segments){  // ellipse, etc.
                        continue;
                    } else if(c.segments.length < 3 || (!c.closed)){
                        continue;
                    } else {
                        body = createPolygon(c);
                    }
                }
                items.push(body);

                // 元の style を保持し、出力時に反映する
                _styles[body.id] = new SavedStyle(c);
            }
        }
    }

    function isCircle(item){
        var b = item.bounds;
        var boundsRatio = calcRatio(item.bounds.width, item.bounds.height);
        var perimeterRatio = calcRatio(item.length, item.bounds.width * Math.PI);
        var areaRatio = calcRatio(item.area, Math.pow(item.bounds.width / 2, 2) * Math.PI);
        //console.log(boundsRatio + "/" + perimeterRatio + "/" + areaRatio);
        
        return boundsRatio < _circleRatioLimit.bounds
          && perimeterRatio < _circleRatioLimit.perimeter
            && areaRatio < _circleRatioLimit.area;
    }

    function calcRatio(a,b){
        var v1, v2;
        if(a > b){
            v1 = a; v2 = b;
        } else {
            v1 = b; v2 = a;
        }
        if(v2 == 0) return Infinity;
        return v1/v2;
    }
    
    function createCircle(item){
        var b = item.bounds;
        return Bodies.circle(b.center.x, b.center.y, b.width / 2, getStyle(item));
    }

    function createRectangle(item){
        var b = item.bounds;
        var s = item.size;
        var body = Bodies.rectangle(b.center.x, b.center.y, s.width, s.height, getStyle(item));
        if(item.rotation){
            var angle = item.rotation * Math.PI / 180;
            Body.rotate(body, angle);
        }
        return body;
    }

    function createPolygon(item){
        var centroid = getCentroid(item);
        var points = getPoints(item, centroid);
        // 凸形状でない場合は、適宜分割されて凸形状の集合体になる。複雑な形状は再現できない場合もある
        return Bodies.fromVertices(centroid.x, centroid.y, points, getStyle(item));
    }

    function isFilledBlack(item){
        var fc = item.fillColor;
        return (fc && fc.red == 0 && fc.green == 0 && fc.blue == 0);
    }

    function color2css(col, nullValue){
        return col ? col.toCSS() : nullValue;
    }
    
    function getStyle(item){
        // ・塗り=null にするとデフォルト色（ランダムカラー）が割り当てられる模様
        // 　なので、塗りなしの場合、背景色を設定している。書き出し時は _styles に保持する元の色が設定される。
        return {
            density : BODY_DENSITY,
            frictionAir : _spec.frictionAir,
            isStatic : isFilledBlack(item),
            render : {
                fillStyle: color2css(item.fillColor, CANVAS_BACKGROUND_COLOR),
                strokeStyle : color2css(item.strokeColor, null),
                lineWidth : item.strokeColor ? item.strokeWidth : 0,
                opacity : item.opacity
            }
        }
    }

    function getPoints(item, centroid){
        var segs = item.segments;
        var r = [];
        for(var i = 0, iEnd = segs.length; i < iEnd; i++){
            r.push(segs[i].point.subtract(centroid));
        }
        return r;
    }

    function getCentroid(item){
        var segs = item.segments;
        var p = segs[0].point.clone();
        for(var i = 1, iEnd = segs.length; i < iEnd; i++){
            p.x += segs[i].point.x;
            p.y += segs[i].point.y;
        }
        return p.multiply(1 / segs.length);
    }
    
    // ----------------------
    // functions to output
    // ----------------------
    // 出力は、各 Body の形状を、別の canvas（display:none）に paper.js
    // で写し取り、exportSVG している。
    // 形状が concave の場合、Body生成時に適宜分割された形状をグループ化
    // したものを出力する。
    
    function body2pathMain(bodies, parent_id){
        var gr;
        var style_id;
        if(parent_id != undefined){
            gr = new paper.Group();
        }
        
        for(var i = 0; i < bodies.length; i++){
            var body = bodies[i];

            if( parent_id == undefined){
                if(body.parts.length > 1){
                    body2pathMain(body.parts, body.id);
                    continue;
                }
                style_id = body.id;
            } else {
                if(body.parts.length > 1){
                    continue;
                }
                style_id = parent_id;
            }

            // クライアント枠の外側にあるものは出力しない
            if(body.bounds.max.y < 0 || body.bounds.min.y > window.innerHeight
                || body.bounds.max.x < 0 || body.bounds.min.x > window.innerWidth){
                continue;
            }

            var path;
            if(body.label == "Circle Body"){
                var radius = body.circleRadius;
                var center = body.position;
                path = new paper.Path.Circle(center, radius);
            } else {  // "Rectangle Body", "Body", "Polygon Body"
                var vs = body.vertices;
                var segs = [];
                for(var j = 0; j < vs.length; j++){
                    segs.push([vs[j].x, vs[j].y]);
                }
                path = new paper.Path({ segments:segs, closed:true });
            }

            // 読み込み時に保持した属性を割り当てる
            _styles[style_id].apply(path);
            
            if(gr){
                gr.appendBottom(path);
            }
        }
    }

    function body2path(){
        body2pathMain(Composite.allBodies(_engine.world));
    }

    function exportSVGtoFile(){
        body2path();
        try{
            if(confirm(getMessage("export_svg_confirm"))){
                if(_spec.url) URL.revokeObjectURL(_spec.url);
                var svg = paper.project.exportSVG();
                var seri = new XMLSerializer();
                var s = seri.serializeToString(svg);
                _spec.url = handleDownload(s);
                alert(getMessage("exported"));
            }
        } catch(e){
            console.log(e);
            alert(getMessage("failed_to_export"));
        } finally {
            paper.project.clear();
        }
    }
    
    function handleDownload(text) {
        var blob = new Blob([ text ], { "type" : "image/svg+xml" });
        var a = document.createElement("a");
        a.target = '_blank';
        a.download = EXPORT_SVG_FILENAME;
        var url;
        var winURL = window.URL || window.webkitURL;
        if(winURL && winURL.createObject) {  //chrome
            url = winURL.createObjectURL(blob);
            a.href = url;
            a.click();
        } else if(window.URL && window.URL.createObjectURL) {  //firefox
            url = window.URL.createObjectURL(blob);
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        return url;
    }

    // ----------------------
    // initialize
    // ----------------------
    // HTML上のステータステキストを更新する
    function updateStatus(){
        var lang = getLang();
        
        $("#stat_gravity_" + lang).text(
            getMessage("stat_gravity") + (_spec.gravity_y ? 1 : 0));
        $("#stat_gravity_" + lang).css("color", _spec.gravity_y ? "#888" : "red");
        
        $("#stat_frictionAir_" + lang).text(
            getMessage("stat_frictionAir")
            + (_spec.frictionAir == FRICTIONAIR_DEFAULT
               ? getMessage("stat_normal")
               : getMessage("stat_frictionAir_high")));
        $("#stat_frictionAir_" + lang).css(
            "color",
            _spec.frictionAir == FRICTIONAIR_DEFAULT ? "#888" : "red");
          
        $("#stat_display_" + lang).text(
            getMessage("stat_display")
            + (_spec.wireframes
               ? getMessage("stat_wireframes")
               : getMessage("stat_normal")));
    }

    function beforeApplyKeyCommand(){
        // キーイベントによるコマンド実行前の処理。
        // 動いている場合はポーズする
        var isRunning = !_spec.isPause;
        if(_runner && !_spec.isPause){
            Runner.stop(_runner);
            _spec.isPause = true;
        }
        return isRunning;
    }
    
    function afterApplyKeyCommand(isRunning){
        // キーイベントによるコマンド実行後の処理。
        // 実行前に動いていた場合は、また動かす
        if(isRunning && _runner && _spec.isPause){
            Runner.run(_runner, _engine);
            _spec.isPause = false;
        }
    }
    
    function key_exportSVGtoFile(){
        if(!_engine){
            alert(getMessage("no_data"));
            return;
        }
        var isRunning = beforeApplyKeyCommand();
        exportSVGtoFile();
        afterApplyKeyCommand(isRunning);
    }

    function key_wireFrame(){
        // 読み込み前に設定できるようにしている
        _spec.wireframes = !_spec.wireframes
        if(_render){
            _render.options.wireframes = _spec.wireframes;
        }
        updateStatus();
    }

    function key_pause(){
        if(_runner){
            if(_spec.isPause){
                Runner.run(_runner, _engine);
            } else {
                Runner.stop(_runner);
            }
            _spec.isPause = !_spec.isPause;
        }
    }

    function key_gravity(){
        // 読み込み前に設定できるようにしている
        _spec.gravity_y = _spec.gravity_y ? 0 : 1;
        if(_engine){
            _engine.world.gravity.y = _spec.gravity_y;
        }
        updateStatus();
    }

    function key_frictionAir(){
        // 読み込み前に設定できるようにしている
        _spec.frictionAir = _spec.frictionAir == FRICTIONAIR_DEFAULT ? FRICTIONAIR_HIGH : FRICTIONAIR_DEFAULT;
        if(_engine){
            var isRunning = beforeApplyKeyCommand();
            
            var bodies = Composite.allBodies(_engine.world);
            for(var i = 0; i < bodies.length; i++){
                var body = bodies[i];
                if( body.isStatic) continue;
                body.frictionAir = _spec.frictionAir;
            }
            
            afterApplyKeyCommand(isRunning);
        }
        updateStatus();
    }
    
    function init() {
        showHelpByLocale();
        
        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleFileSelect);

        document.addEventListener('keydown',(evt) => {
            const keyName = evt.key.toLowerCase();
            if(keyName == "s"){
                key_exportSVGtoFile();
            } else if(keyName == "v"){
                importSVGFromClipboard_paper();
            } else if(keyName == "w"){
                key_wireFrame();
            } else if(keyName == "p"){
                key_pause();
            } else if(keyName == "g"){
                key_gravity();
            } else if(keyName == "a"){
                key_frictionAir();
            }
        });
    }

    function showHelpByLocale(){
        if(getLang() == "ja"){
            $("#help_ja").show();
            $("#status_ja").show();
        } else {
            $("#help_en").show();
            $("#status_en").show();
        }
    }

    // ----------------------
    // locale
    // ----------------------
    function getLang(){
        //return "en";
        return navigator.language.startsWith("ja") ? "ja" : "en";
    }
    
    function getMessage(entry){
        var obj = _messages[entry];
        var lang = getLang();

        if(obj){
            return obj[lang] || obj["en"].toString();
        } else {
            return "undefined:[" + entry + "]";
        }
    }
    
    _messages = {
        already_loaded : {
            "en" : "already loaded. please reload the page to refresh",
            "ja" : "すでに読み込まれたデータがあります。別のデータを読み込むには頁をリロードしてください。"
        },
        please_select_a_svg : {
            "en" : "Please drop a SVG file.(Dropped file is ",
            "ja" : "SVGファイルをドロップしてください。(入力ファイル="
        },
        paste_failed : {
            "en" : "paste failed",
            "ja" : "貼付データの読み込みに失敗しました"
        },
        paste_chrome_only_for_now : {
            "en" : "Loading by paste is currently available only for Chrome(ver.66 or later)",
            "ja" : "貼付によるロードは今のところChrome(ver.66以降)のみ対応です"
        },
        no_data : {
            "en" : "no data",
            "ja" : "出力データなし"
        },
        export_svg_confirm  : {
            "en" : "export SVG file?",
            "ja" : "SVGファイルをエクスポートしますか？"
        },
        exported : {
            "en" : "exported",
            "ja" : "エクスポート完了"
        },
        failed_to_export : {
            "en" : "failed to export",
            "ja" : "エクスポートに失敗しました"
        },
        stat_gravity : {
            "en" : "gravity=",
            "ja" : "重力="
        },
        stat_frictionAir : {
            "en" : "airResistance=",
            "ja" : "空気抵抗="
        },
        stat_normal : {
            "en" : "normal",
            "ja" : "通常"
        },
        stat_frictionAir_high : {
            "en" : "HIGH",
            "ja" : "重い"
        },
        stat_display : {
            "en" : "display=",
            "ja" : "表示="
        },
        stat_wireframes : {
            "en" : "wireframes",
            "ja" : "ワイヤーフレーム"
        }
    }
    
    init();
}());
    
