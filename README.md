# simple-svg-physics-runner

[Readme in Japanese](https://github.com/shspage/simple-svg-physics-runner/blob/master/README_ja.md) 

### Summary
* Loading SVG data on the browser via file or clipboard.
* Applying physical effects to it.
* Putting out SVG data.  

![description](https://github.com/shspage/simple-svg-physics-runner/blob/master/image/description.gif)

### How to use
* Hit "v" to load SVG code from clipboard. (Chrome 66 or later)  
  alternatively, drag and drop SVG file to load.

* After loading, the objects filled with **black** stay on fixed position.  
  Other objects move according to the law of physics, and draggable.

* It loads only paths (circle and polygon). Compound paths are not available.  
  Also, **the curve other than the circle** becomes a polygonal line.

* Hit "p" to toggle pause/play.
* Hit "s" to export SVG file.
* Hit "w" to toggle wireframes.
* Hit "g" to toggle gravity 0/1.
* Hit "a" to toggle air resistance normal/HIGH

* "w", "g" and "a" can be set before loading.

----

* Illustrator: If there's a group with a name that starts with "chain", the objects in the group are chained vertically, anchored at the top.   
video - https://twitter.com/shspage/status/1757720353638674790

### Try using
https://shspage.github.io/simple-svg-physics-runner/

### Note:
* Loading from the clipboard does not work with the http protocol (works with https or file)
* Non-convex polygons in SVG data are automatically converted to a group of convex polygons,
and when you save them as SVG, they are exported as it is (a group of convex polygons).
* In Illustrator, the original path may be changed automatically when SVG code is generated.
For example, a line whose "line position" is not "center" is converted to a compound path with fill color of original line color.
A compound path is not displayed on the screen because it is not processed by this script.
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


### ChangeLog
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
