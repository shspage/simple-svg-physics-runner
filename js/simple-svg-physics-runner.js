/*
simple-svg-physics-runner

2024.02.20, v.1.2.0b

* Copyright(c) 2018 Hiroyuki Sato
  https://github.com/shspage/simple-svg-physics-runner
  This software is distributed under the MIT License.
  See the LICENSE.txt for details.
  
  This software uses the following libraries that may have licenses
  differing from that of the software itself. You can find the
  libraries and their respective licenses below.
-------------------------------------------
required libraries (and the version tested with)
* jQuery (v3.7.1)  
  License MIT  
  (c) OpenJS Foundation and other contributors | jquery.org/license

* matter-js (0.19.0) http://brm.io/matter-js/  
  License MIT  
  Copyright (c) Liam Brummitt and contributors.

* Paper.js (v0.12.17)  http://paperjs.org/  
  License MIT  
  Copyright (c) 2011 - 2020, Jürg Lehni & Jonathan Puckey  
  http://juerglehni.com/ & https://puckey.studio/

* decomp.js (https://github.com/schteppe/poly-decomp.js)  
  License MIT  
  Copyright (c) 2013 Stefan Hedman

 */

(function () {
    'use strict';
    Matter.use('matter-wrap');
    console.log("@shspage: The wrap plugin appears to be working despite the required version unmatch");

    const EXPORT_SVG_FILENAME = "output.svg";
    const CANVAS_BACKGROUND_COLOR = "#fafafa";
    const BODY_DENSITY = 0.12;  // default=0.001
    const FRICTIONAIR_DEFAULT = 0.01;  // 空気抵抗の既定値
    const FRICTIONAIR_HIGH = 0.8;      // 空気抵抗=重い の値
    const GRAVITY_Y_DEFAULT = 1; // 重力=通常 の値
    const RESTITUTION_DEFAULT = 0.35; // 反発の既定値

    // Matter.Engine properties
    // * The higher the value, the higher quality the simulation will be at the expense of performance.
    // * 各値を増やすことでパフォーマンスと引き換えにシミュレーションの品質を上げることができる。
    //   各値がどのように影響するかは、Demo頁の右から引き出せるスライダ群を操作してみると手掛かりになるかも。
    const ENGINE_POSITION_ITERATIONS = 12;  // positionIterations, default=6
    const ENGINE_VELOCITY_ITERATIONS = 4;  // velocityIterations, default=4
    const ENGINE_CONSTRAINT_ITERATIONS = 2;  // constraintIterations, default=2

    const DECOMP_MINIMUM_AREA = 0; // 複合パスを図形に分解した際に削除する図形の最大面積
    const DUPLICATE_POINT_TOLERANCE = 0.01; // 複合パスの重複点を取り除くときの許容差
    const REMOVE_COLLINEAR_PRECISION = 0.01; // 頂点が直線上にあると見なす許容差
    const FLATTEN_FLATNESS = 0.25; // 曲線を折れ線化する際の許容誤差

    // AS_BLACK_THRESHOLD_RGB:
    // * In Illustrator, black in CMYK mode is not converted to #000 in generated SVG code.
    //   This means the object doesn't stay on fixed position.
    //   So, set the upper limit of RGB values that is considered black. (0-255 = 0-1)
    //   If all RGB values are below the upper limit, it will be converted to #000,
    //   and it will also be #000 when exporting.
    //   If you ignore CMYK mode, it's OK to set this [0,0,0].
    // * イラレのCMYKモードでの黒(K100)は、生成されるSVGコードでは#000にならない。
    //   つまり位置が固定されない。
    //   以下で黒と見なすRGBそれぞれの上限値を設定しておくと(0～255 を 0～1 とする）、
    //   RGB全てが上限値以下の場合に#000に変換され、エクスポート時も#000になる。
    //   CMYKモードを考慮しない場合は [0,0,0] に設定してもよい。
    const AS_BLACK_THRESHOLD_RGB = [0.1373, 0.0942, 0.0824]; // about #231815

    paper.setup("hidden_canvas");
    
    var Body = Matter.Body,
        Bodies = Matter.Bodies,
        Vertices = Matter.Vertices,
        Vector = Matter.Vector,
        Mouse = Matter.Mouse,
        MouseConstraint = Matter.MouseConstraint,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Constraint = Matter.Constraint,
        Composites = Matter.Composites,
        Composite = Matter.Composite,
        Engine = Matter.Engine,
        Common = Matter.Common;

    var _spec = {
        url:null,
        isPause:false,
        wireframes: false,
        gravity_y: 0,
        frictionAir:FRICTIONAIR_DEFAULT,
        _decomp_fail_count:0
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
    
    var _svgShapes = {}; // { body.id : paper.Item }

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

        Composite.add(_engine.world, mouseConstraint);
        Composite.add(_engine.world, items);
        
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
            _spec._decomp_fail_count = 0;

            paper.project.view.viewSize = new paper.Size(
                window.innerWidth, window.innerHeight);
            
            paper.project.importSVG(data);
            fixTopLeftAfterImport();
            paper2matter();
            
            var msg = "LOADED";
            if(_spec._decomp_fail_count > 0){
                msg += " / decomp error (" + _spec._decomp_fail_count + ")";
            }
            alert(msg);
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
    //   Paths are kept in the background and used when exporting.
    // * クリップボードまたはファイルからのSVGデータ取り込み。
    //   paper.js の importSVG で行う。Matter.js にも SVG 取り込みの
    //   メソッドはあるが、サンプルコードにあるのは形状を取り込む処理
    //   だけで、色を取得する処理がない。SVG のデータも色々なものが
    //   あるので、自力で解析する処理を書くより、paper.js のクラスに
    //   落とし込んだほうが扱いやすいと考えた。
    //   このためここでは、paper.js で取り込んだ Path を Matter.js の
    //   Body に変換する処理をしている。
    //   Path はバックグラウンドで保持され、エクスポート時に使われる。
    
    function paper2matter(){
        var items = [];
        extractItems(paper.project.activeLayer.children, items, "");
        setupWorld(items);
    }

    function extractItems(children, items, parent_name){
        var grp, grp_type, is_wrap, coll_group;
        if(parent_name){
            if(parent_name.startsWith("chain")){
                grp = Composite.create();
                grp_type = "chain";
            } else if(parent_name.startsWith("bridge")){
                grp = Composite.create();
                grp_type = "bridge";
                coll_group = Body.nextGroup(true);
            } else if(parent_name.startsWith("loop")){
                grp = Composite.create();
                grp_type = "loop";
                coll_group = Body.nextGroup(true);
            }

            is_wrap = parent_name.includes("wrap");
        }

        for(var i = children.length - 1; i >= 0; i--){
            var c = children[i];
            var body;
            if(c.className == 'Layer'){
                extractItems(c.children, items, c.name);
            } else if(c.className == 'Group'){
                extractItems(c.children, items, c.name + "." + parent_name);
            } else if(c.clipMask){
                c.remove();
            } else if(c.className == "CompoundPath"){
                if(!coll_group) coll_group = Body.nextGroup(true);
                body = createCompoundBody(c, coll_group);
                if(body){
                    if(is_wrap) addWrap(body);
                    items.push(body);
                    _svgShapes[body.id] = c;
                }
            } else if(c.className == "Shape" || c.className == "Path"){
                if(c.shape == "rectangle"){
                    body = createRectangle(c);
                } else if(c.shape == "circle" || isCircle(c)){
                    body = createCircle(c);
                } else if(c.shape == "ellipse"){
                    var tmp_path = c.toPath();
                    body = createPolygon(tmp_path);
                    tmp_path.remove();
                } else if(c.segments){
                    if(c.closed){
                        body = createPolygon(c);              
                    }
                }
                if(!body) continue;

                if(grp_type == "chain" || grp_type == "bridge" || grp_type == "loop"){
                    if(coll_group) body.collisionFilter.group = coll_group;
                    Composite.addBody(grp, body);
                } else {
                    if(is_wrap) addWrap(body);
                    items.push(body);
                }

                _svgShapes[body.id] = c;
            }
        }

        if(grp_type == "chain"){
            createChain(grp, parent_name);
            items.push(grp);
        } else if(grp_type == "bridge"){
            createBridge(grp);
            items.push(grp);           
        } else if(grp_type == "loop"){
            if(is_wrap) addWrap(grp);
            // create outer constraints
            grp.bodies = sortBodiesByNearest(grp.bodies);
            var stiffness = 0.2;
            createLoop(grp, stiffness);
            // create inner constraints
            if(grp.bodies.length > 3){
                grp.bodies = sortBodiesByNearest(grp.bodies, true);
                var ignoreLast = true;
                stiffness = 0.2;
                createLoop(grp, stiffness, ignoreLast);    
            }
            items.push(grp);
        }
    }

    function addWrap(body){ // body or composite
        body.plugin.wrap = {
            min: {
              x: 0,
              y: 0
            },
            max: {
              x: window.innerWidth,
              y: window.innerWidth
            }
          };
    }

    function createChain(grp, parent_name){
        // sort bodies from top to bottom. the pivot of chain is placed at the top body.
        var as_is = parent_name.includes("_as_is");
        if(grp.bodies.length > 1){
            grp.bodies.sort(function(a,b){ return a.position.y - b.position.y; });
            if(as_is){
                for(var i = 0, iEnd = grp.bodies.length - 1; i < iEnd; i++){
                    var b = grp.bodies[i];
                    var b1 = grp.bodies[i + 1]
                    Composite.add(grp, Constraint.create({
                        bodyA: b, 
                        bodyB: b1,
                        length: Vector.magnitude(Vector.sub(b.position, b1.position)),
                        stiffness: 0.99,
                        render: { visible:false }                                
                    }))
                }    
            } else {
                Composites.chain(grp, 0, 0.5, 0, -0.5, { stiffness: 0.99, length: 1, render: { visible:false } });  
                // 最後の constraint の動作が固い。原因は今のところ不明。
                grp.constraints[grp.constraints.length - 1].stiffness = 0.66;
            }
        }
        if(true){
            var b = grp.bodies[0];
            var bHeight = b.bounds.max.y - b.bounds.min.y
            Composite.add(grp, Constraint.create({
                bodyB: b,
                pointB: { x: 0, y: -bHeight / 2 },
                pointA: { x: b.position.x, y: b.position.y - bHeight / 2},
                stiffness: 1,
                render: { visible:false }
            }));
        }
    }

    function createBridge(grp){
        // sort bodies horizontaly. the pivot of chain is placed at both ends of bodies.
        if(grp.bodies.length < 1) return;

        if(grp.bodies.length > 1){
            grp.bodies.sort(function(a,b){ return a.position.x - b.position.x; });
        }
        var left = grp.bodies[0].bounds.min.x;
        var right = grp.bodies[grp.bodies.length - 1].bounds.max.x;
        if(grp.bodies.length > 1){
            Composites.chain(grp, 0.5, 0, -0.5, 0, { stiffness: 0.99, length: 0.0001, render: { visible: false } });
            // 最後の constraint の動作が固い。原因は今のところ不明。
            grp.constraints[grp.constraints.length - 1].stiffness = 0.66;
        }
        var b = grp.bodies[0];
        var bWidth = b.bounds.max.x - b.bounds.min.x;
        Composite.add(grp, Constraint.create({
            bodyB: b,
            pointB: { x: -bWidth / 2, y: 0 },
            pointA: { x: left, y: b.position.y },
            length: 2,
            stiffness: 0.9,
            render: { visible: false }
        }));
        b = grp.bodies[grp.bodies.length - 1];
        bWidth = b.bounds.max.x - b.bounds.min.x;
        Composite.add(grp, Constraint.create({
            bodyB: b,
            pointB: { x: bWidth / 2, y: 0 },
            pointA: { x: right, y: b.position.y },
            length: 2,
            stiffness: 0.9,
            render: { visible: false }
        }));
    }

    function createLoop(grp, stiffness, ignoreLast){
        // ignoreLast: if true, ignore last body
        var bLength = grp.bodies.length;
        if(bLength == 1) return;
        for(var i = 0; i < bLength; i++){
            if(ignoreLast && i == bLength - 1) break;
            var b = grp.bodies[i];
            var nextIndex = i == bLength - 1 ? 0 : i + 1;
            var b1 = grp.bodies[nextIndex];
            Composite.add(grp, Constraint.create({
                bodyA: b, 
                bodyB: b1,
                length: Vector.magnitude(Vector.sub(b.position, b1.position)),
                stiffness: stiffness,
                //render: { type: 'line' }
                render: { visible:false }
            }))
        }
    }

    function sortBodiesByNearest(bodies, farthest){
        // if farthest == true, sorts by farthest
        if(bodies.length < 3) return bodies;
        var bs = [bodies[0]];
        bodies.splice(0, 1);
        while(bodies.length > 0){
            var b = bs[bs.length - 1];
            var min_dist = -1, nearest_idx;
            for(var i = 0, iEnd = bodies.length; i < iEnd; i++){
                var d = Vector.magnitudeSquared(Vector.sub(b.position, bodies[i].position));
                if(farthest){
                    if(min_dist < 0 || d > min_dist){
                        min_dist = d;
                        nearest_idx = i;
                    }    
                } else {
                    if(min_dist < 0 || d < min_dist){
                        min_dist = d;
                        nearest_idx = i;
                    }    
                }
            }
            bs.push(bodies[nearest_idx]);
            bodies.splice(nearest_idx, 1);
        }
        return bs;
    }

    function isCircle(item){
        var b = item.bounds;
        var boundsRatio = calcRatio(item.bounds.width, item.bounds.height);
        var perimeterRatio = calcRatio(item.length, item.bounds.width * Math.PI);
        var areaRatio = calcRatio(item.area, Math.pow(item.bounds.width / 2, 2) * Math.PI);
        
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

    function createPolygon(c){
        var center = c.bounds.center;
        var c1 = c.clone();
        c1.flatten(FLATTEN_FLATNESS);
        var vertices = getPoints(c1, center);
        c1.remove();
        removeDuplicatePoints(vertices);

        var options = getStyle(c);
        var body;
        if(!Vertices.isConvex(vertices)){
            var parts = [];
            var decomped_parts = [];
            decompPolygon(vertices, decomped_parts);
            if(decomped_parts.length > 0){
                for (var i = 0, iEnd = decomped_parts.length; i < iEnd; i++) {
                    var part_body = Body.create(Common.extend(decomped_parts[i], options));
                    parts.push(part_body);
                }
                body = Body.create(options);
                Body.setParts(body, parts);
                Body.translate(body, center);
            }
        } else {
            body = Bodies.fromVertices(center.x, center.y, vertices, options);
        }
        return body;
    }

    function createCompoundBody(c, coll_group){
        var center = c.bounds.center;
        var parts = [];
        var parts_blank = [];
        var options = {
            density : BODY_DENSITY,
            frictionAir : _spec.frictionAir,
            restitution : RESTITUTION_DEFAULT, 
            isStatic : isFilledBlack(c),
            collisionFilter: { group: coll_group },
            render : { fillStyle: CANVAS_BACKGROUND_COLOR }
        };
        var c1 = c.clone();
        c1.flatten(FLATTEN_FLATNESS);
        for(var ci = 0, ciEnd = c.children.length; ci < ciEnd; ci++){
            var child = c1.children[ci];
            var parts_tmp, part_label;
            var n = countContainsEx(ci, c.children);
            if(n % 2 == 0){
                options.render.fillStyle = color2css(c.fillColor, CANVAS_BACKGROUND_COLOR);
                parts_tmp = parts;
                part_label = "";
            } else {
                options.render.fillStyle = CANVAS_BACKGROUND_COLOR;
                parts_tmp = parts_blank;
                part_label = "blank";
            }
            var vertices = getPoints(child, center);
            removeDuplicatePoints(vertices);

            if(!Vertices.isConvex(vertices)){
                var decomped_parts = [];
                decompPolygon(vertices, decomped_parts);
                for (var i = 0, iEnd = decomped_parts.length; i < iEnd; i++) {
                    var body = Body.create(Common.extend(decomped_parts[i], options));
                    body.label = part_label;
                    parts_tmp.push(body);
                }
            } else {
                var body = Body.create(Common.extend({
                    position: Vertices.centre(vertices),
                    vertices: vertices
                }, options));
                body.label = part_label;
                parts_tmp.push(body);
            }
        }
        c1.remove();

        var parts_all = parts.concat(parts_blank);
        var compound;
        if(parts_all.length > 0){
            compound = Body.create({
                density : BODY_DENSITY,
                frictionAir : _spec.frictionAir,
                restitution : RESTITUTION_DEFAULT, 
                isStatic : isFilledBlack(c) });
            Body.setParts(compound, parts_all);
            Body.translate(compound, center);
            //Body.setPosition(compound, center);
        }
        return compound;
    }

    // decomp processing referred to Bodies.fromVertices in matter.js
    function decompPolygon(vertices, decomped_parts){
        if(decomp && decomp.quickDecomp){
            var concave = vertices.map(function(vertex) {
                return [vertex.x, vertex.y];
            });
            decomp.makeCCW(concave);
            decomp.removeCollinearPoints(concave, REMOVE_COLLINEAR_PRECISION);
            var decomposed = decomp.quickDecomp(concave);

            if(decomposed.length < 1){
                console.log("decomp failed");
                _spec._decomp_fail_count++;
                return;
            }

            for (var i = 0, iEnd = decomposed.length; i < iEnd; i++) {
                var chunk = decomposed[i];

                // convert vertices into the correct structure
                var chunkVertices = chunk.map(function(vertices) {
                    return {
                        x: vertices[0],
                        y: vertices[1]
                    };
                });

                // skip small chunks
                if (DECOMP_MINIMUM_AREA > 0 && Vertices.area(chunkVertices) < DECOMP_MINIMUM_AREA)
                    continue;

                // create a compound part
                decomped_parts.push({
                    position: Vertices.centre(chunkVertices),
                    vertices: chunkVertices
                });
            }
        }    
    }

    function countContainsEx(ci, children){
        var n0 = countContains(ci, children, 0);
        var n1 = countContains(ci, children, parseInt(children[ci].segments.length / 2));
        return Math.min(n0, n1);
    }

    function countContains(ci, children, idx){
        // * A simple check to see how many shapes that include 
        //   children[ci] inside the elements (children) of compound path.
        //   Assume that there are no intersections of elements.
        //   If the result is an odd number, consider children[ci] to be a hole.
        // compound path の要素(children)の中に、
        // children[ci] を内側に含む図形がいくつあるか
        // の簡易的なチェック。要素の交差はないと仮定。
        // 結果が奇数の場合、children[ci] は hole と考える。
        var n = 0;
        var p = children[ci].segments[idx].point;
        for(var i = 0, iEnd = children.length; i < iEnd; i++){
            if(i == ci) continue;
            if(children[i].contains(p)){
                n++;
            }
        }
        return n;
    }

    function removeDuplicatePoints(points){
        function checkDuplicatePoint(p, p1){
            return Math.abs(p.x - p1.x) < DUPLICATE_POINT_TOLERANCE
             && Math.abs(p.y - p1.y) < DUPLICATE_POINT_TOLERANCE;
        }
        var idx = points.length - 1;
        var p = points[idx];
        var p1;
        while(idx > 0){
            idx--;
            p1 = points[idx];
            if(checkDuplicatePoint(p, p1)){
                points.splice(idx, 1);
            } else {
                p = p1;
            }
        }
        if(points.length > 1){
            p = points[points.length - 1];
            p1 = points[0];
            if(checkDuplicatePoint(p, p1)){
                points.splice(0, 1);
            }
        }
    }

    function isFilledBlack(item){
        var result = false;
        var fc = item.fillColor;
        //return (fc && fc.red == 0 && fc.green == 0 && fc.blue == 0);
        var rgb = AS_BLACK_THRESHOLD_RGB;
        if(fc && fc.red <= rgb[0] && fc.green <= rgb[1] && fc.blue <= rgb[2]){
            fc.red = 0; fc.green = 0; fc.blue = 0;
            result = true;
        }
        return result;
    }

    function color2css(col, nullValue){
        return col ? col.toCSS() : nullValue;
    }
    
    function getStyle(item){
        // ・塗り=null にするとデフォルト色（ランダムカラー）が割り当てられる模様
        // 　なので、塗りなしの場合、背景色を設定している。
        return {
            density : BODY_DENSITY,
            frictionAir : _spec.frictionAir,
            restitution : RESTITUTION_DEFAULT, 
            isStatic : isFilledBlack(item),
            render : {
                fillStyle: color2css(item.fillColor, CANVAS_BACKGROUND_COLOR),
                strokeStyle : color2css(item.strokeColor, null),
                lineWidth : item.strokeColor ? item.strokeWidth : 0,
                opacity : item.opacity
            }
        }
    }

    function getPoints(item, center){
        var segs = item.segments;
        var r = [];
        for(var i = 0, iEnd = segs.length; i < iEnd; i++){
            r.push(segs[i].point.subtract(center));
        }
        return r;
    }

    /* function getCentroid(item){
        var segs = item.segments;
        var p = segs[0].point.clone();
        for(var i = 1, iEnd = segs.length; i < iEnd; i++){
            p.x += segs[i].point.x;
            p.y += segs[i].point.y;
        }
        return p.multiply(1 / segs.length);
    } */

   // ----------------------
    // functions to output
    // ----------------------
    // body.id に関連づけた、paper.js でimportした元の形状を、
    // 別レイヤーにコピーし、body の移動・回転を適用したうえで exportSVG する。
    function exportSVGtoFile(){
        if(confirm(getMessage("export_svg_confirm"))){
            try{
                var active_layer = paper.project.activeLayer;
                var layer = body2path();
                active_layer.visible = false;

                if(_spec.url) URL.revokeObjectURL(_spec.url);
                var svg = paper.project.exportSVG();
                var seri = new XMLSerializer();
                var s = seri.serializeToString(svg);
                _spec.url = handleDownload(s);
                alert(getMessage("exported"));
            } catch(e){
                console.log(e);
                alert(getMessage("failed_to_export"));
            } finally {
                layer.remove();
                active_layer.visible = true;
            }
        }
    }

    function body2path(){
        var all_bodies = Composite.allBodies(_engine.world);
        var layer = new paper.Layer();
        for(var i = 0, iEnd = all_bodies.length; i < iEnd ; i++){
            var body = all_bodies[i];
            if(!(body.id in _svgShapes)) continue;

            // クライアント枠の外側にあるものは出力しない
            if(body.bounds.max.y < 0 || body.bounds.min.y > window.innerHeight
                || body.bounds.max.x < 0 || body.bounds.min.x > window.innerWidth){
                continue;
            }

            var path = _svgShapes[body.id].copyTo(layer);
            if(body.label != "Circle Body"){
                path.rotate(body.angle * 180 / Math.PI);
            }
            var body_center = new paper.Point(
                (body.bounds.max.x + body.bounds.min.x) / 2,
                (body.bounds.max.y + body.bounds.min.y) / 2
            );
            path.translate(body_center.subtract(path.position));
        }
        return layer;
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
            getMessage("stat_gravity") + (_spec.gravity_y ? GRAVITY_Y_DEFAULT : 0));
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
        _spec.gravity_y = _spec.gravity_y ? 0 : GRAVITY_Y_DEFAULT;
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
        //return "en"; // for test
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
    
