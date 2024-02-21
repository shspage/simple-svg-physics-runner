# simple-svg-physics-runner

[Readme in Japanese](https://github.com/shspage/simple-svg-physics-runner/blob/master/README_ja.md) 

### Summary
* Loading SVG data on the browser via file or clipboard.
* Applying physical effects to it.
* Putting out SVG data.  

![description](https://github.com/shspage/simple-svg-physics-runner/blob/master/image/description.gif)

* The initial value of **gravity** is 0 in version 1.1.2b or later. Press "g" for normal gravity.

### How to use
* Hit "v" to load SVG code from clipboard. (Chrome 66 or later)  
  alternatively, drag and drop SVG file to load.

* It loads only closed paths. After loading, the objects filled with **black** stay on fixed position.  
  Other objects move according to the law of physics, and draggable.

* Hit "p" to toggle pause/play.
* Hit "s" to export SVG file.
* Hit "w" to toggle wireframes.
* Hit "g" to toggle gravity 0/1.
* Hit "a" to toggle air resistance normal/HIGH

* "w", "g" and "a" can be set before loading.

----
### Advanced usage (Illustrator)

#### Control by LAYER name
* If the layer name includes "wrap", objects that go out of the screen will come in from the opposite side of the screen.  
(I recommend setting gravity to 0 before use.)

#### Control by GROUP name
* If the group name starts with "chain", the objects in the group are chained vertically, anchored at the top.   
video - https://twitter.com/shspage/status/1757720353638674790
* Similarly, if it starts with "bridge", the ends are fixed and connected horizontally.
* Similarly, if it starts with "loop", it will be connected in a loop. (Connect with each nearest and farthest object.)
* If the group name starts with "chain" and includes " as is"(it needs first space), the original objects will be connected while maintaining their positions.

#### Control by OBJECT name
* If the name contains "hangN" (N is a natural number), it will generate a line hanging from above. N is the length of the line.
In addition, if "offsetN" (N: -0.5 to 0.5) is included, the position connected to the line will be shifted by the ratio to the vertical width. In addition, if "#N" (N is a 3-digit or 6-digit hexadecimal number) is included, the line color will be changed. If it contains "hidden", no line will be drawn. These words work even if they are in the name of a group or layer.

### Try using
https://shspage.github.io/simple-svg-physics-runner/

### Note:
* Loading from the clipboard does not work with the http protocol (works with https or file)
* Non-convex polygons in SVG data are automatically converted to a group of convex polygons,
and when you save them as SVG, they are exported as the original SVG shapes.  
  Splitting into convex polygons may not work well for complex shapes.
* **IMPORTANT** : In Illustrator, the original path may be changed automatically when SVG code is generated.
For example, **a line whose "line position" is not "center"** is converted to a compound path with fill color of original line color.
* When stacking objects are output as SVG, you may notice where the edges of the objects dig into each other.
If there is enough processing power of your computer, you can mitigate this by increasing ENGINE_POSITION_ITERATIONS at the beginning of simple-svg-physics-runner.js.
(Though I'm not sure whether it is appropriate to adjust this value to improve accuracy.
Either way, I guess, for a physics engine, some error may be necessary for stability of processing.)
There are some other constants you can change in the above script beginning part.
However, it does not cover all attributes.
For the details about attributes, please refer to Matter.js document.

* In Illustrator, black (K100) in CMYK mode is not converted to #000 in the generated SVG code.
This means the object doesn't stay on fixed position.
So, if RGB is (35,24,21) or lower respectively, it is considered black and converted to #000,
and it is also set to #000 when exporting.
If you do not want to perform this color conversion, please set AS_BLACK_THRESHOLD_RGB to [0,0,0]
in simple-svg-physics-runner.js.

* Compound paths are drawn as shapes with no "holes". What looks like a hole is a shape painted with the background color. Therefore, you cannot place other shapes inside the "hole".


### ChangeLog
#### v.1.2.0b1
* Added control using "hang" etc. in object name.
* If "data-name" is in attributes of an SVG element, it will be used instead of "id".

#### v.1.2.0b
* Added processing to convert curves to polylines as appropriate.
* Exports the original SVG shapes, even if polygons and curves are reshaped to handle with the physics engine.

#### v.1.1.2b1
* Changed the text display to red when gravity is 0. Changed normal gravity value to 1.
* Set the restitution value to all bodies.
* Tentative fix for the problem where the last constraint of "chain" and "bridge" is hard.

#### v.1.1.2b
* Set default gravity to 0, normal gravity to 0.8.
* Added "wrap" feature. (matter-wrap plugin appears to be working despite the required version unmatch)
* Supports drawing compound paths. (See also note section for additional notes.)

#### v.1.1.1
* Illustrator: Added a function to connect objects in a loop when the group name starts with "loop".
* Illustrator: If the group name starts with "chain" and includes " as is"(it needs first space), the original objects will be connected while maintaining their positions.

#### v.1.1.0
* updated required libraries.
* removed canvas scrollbars.
* Illustrator: Added a function to connect objects in the horizontal direction when the group name starts with "bridge".

#### v.1.0.2
* Added a setting of upper limit of RGB values ​​to be considered as black. (AS_BLACK_THRESHOLD_RGB)
* Illustrator: Added a function to connect objects in the vertical direction when the group name starts with "chain".

#### v.1.0.1
* A path is regarded as a circle if the difference between the width and the height and the difference between the circumference / area calculated from the width as the diameter and the actual value is less than the set value.  
(This is for SVG files created with Inkscape. Classification methods may need further consideration.)
* Adjusting the upper left corner of the loaded figure to be at the upper left of the canvas.

### TODO
* Loading from the clipboard with firefox
* flattening curves including ellipses automatically

### License
* Copyright(c) 2018 Hiroyuki Sato  
  https://github.com/shspage/simple-svg-physics-runner  
  This software is distributed under the MIT License.  
  See the LICENSE.txt for details.
  
  This software uses the following libraries that may have licenses
  differing from that of the software itself. You can find the
  libraries and their respective licenses below.

#### required libraries (including in this repo)
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
