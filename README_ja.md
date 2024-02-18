# simple-svg-physics-runner

### 概要
* ファイルまたはクリップボードを介してSVGデータを読み込みます。
* 読み込んだ形状は物理法則に従って動きます。
* 表示内容はSVGデータとして出力できます。

![description](https://github.com/shspage/simple-svg-physics-runner/blob/master/image/description.gif)

### 使い方
* "v" を押すと、クリップボードのSVGコードを読み込みます。(Chrome 66以降)

* ドラッグ＆ドロップしたSVGファイルを読み込むこともできます。

* 読み込み後、塗り色が**黒**のものは位置が固定されます。
　それ以外のものは物理法則に従って動きます。  
　ドラッグで動かすこともできます。

* 読み込めるのはクローズパス（円と多角形および複合パス）です。楕円(ellipse)は非対応です。
  **円以外の曲線** はアンカーポイントを結ぶ折れ線になります。

* "p" を押すと、ポーズ／再生 を切り替えます。

* "s" を押すと、SVGファイルを出力します。

* "w" を押すと、ワイヤーフレーム表示を切り替えます。

* "g" を押すと、無重力状態を切り替えます。

* "a" を押すと、空気抵抗（通常/重い）を切り替えます。

* w,g,a は、読み込み前に切り替えておくことができます。

----
### 進んだ使い方（Illustrator）

#### レイヤー名による制御
* レイヤー名に「wrap」を含む場合、画面外に出たオブジェクトは画面の反対側から入ってきます。  
（重力を０に設定してからの使用をおすすめします。）

#### グループ名による制御
* グループ名が「chain」で始まる場合、グループ内のオブジェクトは垂直方向に連結され、上部で固定されます。  
video - https://twitter.com/shspage/status/1757720353638674790
* 同様に「bridge」で始まる場合は左右方向に連結され、両橋が固定されます。
* 同様に「loop」で始まる場合はループ状に連結されます。（それぞれの最も近い・遠いオブジェクトと連結します。）
* 「chain」で始まるグループ名が「 as is」(asの前に空白が必要)を含む場合、元のオブジェクトの位置を維持して連結します。

### 使ってみる
https://shspage.github.io/simple-svg-physics-runner/

### 補足：
* クリップボードからの読み込みはhttpプロトコルでは動作しません（httpsかfileで動作）
* SVGデータ中の凸でない多角形は自動的に凸多角形の集合体になり、SVG保存時には凸多角形のグループとして出力されます。  
  凸多角形への分割は、複雑な図形ではうまくいかない場合があります。
* 【重要】Illustratorでは、SVGコード出力・生成時に、元のパスが自動的に変更されることがあります。
たとえば **「線の位置」が「中央」でない線** は、線色を塗り色としてアウトライン化された複合パスになります。
* 積み重なった物体などをSVG出力すると、物体の端がお互いに食い込んでいる箇所に気が付くかもしれません。
コンピュータの処理能力に余裕があれば、simple-svg-physics-runner.js 冒頭の ENGINE_POSITION_ITERATIONS を増やすことで、これを緩和できると思われます。
（精度向上のためにこの値を調整することが適切なのかは、私もまだよくわかりませんが。
いずれにしても、物理エンジンにとってある程度の誤差は処理の安定性のために必要なものなのかもしれません。）
上記のスクリプト冒頭部には、他にも変更可能な定数がいくつかあります。しかし全ての属性を網羅しているわけではありません。
詳細は Matter.js のドキュメントを参照してください。

* IllustratorのCMYKモードでの黒(K100)は、生成されるSVGコードでは#000になりません。つまり位置を固定する対象になりません。
このため、RGBがぞれぞれ (35,24,21) 以下の場合は黒と見なして#000に変換し、エクスポート時も#000にしています。
この色変換を行いたくない場合、simple-svg-physics-runner.js で AS_BLACK_THRESHOLD_RGB を[0,0,0] に設定してください。

* 複合パスは「穴」がない図形として描画されます。穴に見えるのは背景色で塗られた図形です。このため穴の内部に他の図形を置くことはできません。


### 変更履歴
### v.1.1.2b
* 重力の初期値を 0 に変更。通常の重力の値を 0.8 に変更。
* "wrap"機能を追加。（matter-wrapのバージョン整合性が一致しませんが動作しているようです。）
* 複合パスの描画に対応。(note の注意事項もご覧ください。)

#### v.1.1.1
* Illustrator: グループ名が"loop"で始まる場合に、中のオブジェクトをループ状に連結する機能を追加。
* Illustrator: グループ名が"chain"で始まり、" as is"を含む場合に、中のオブジェクトを元の位置を維持して連結する機能を追加。

#### v.1.1.0
* 必須ライブラリを更新しました。
* canvasからスクロールバーを取り除きました。
* Illustrator: グループ名が"bridge"で始まる場合に、中のオブジェクトを左右方向に連結する機能を追加。

#### v.1.0.2
* RGB値が全て設定値以下の場合黒と見なす処理を追加。(AS_BLACK_THRESHOLD_RGB)
* Illustrator: グループ名が"chain"で始まる場合に、中のオブジェクトを上下方向に連結する機能を追加。

#### v.1.0.1
* 幅と高さの差、および幅を直径として算出した周長・面積と実際の値との差が設定値未満であれば、パスを円と見なすようにしました。  
(Inkscapeで作成したSVGへの対応用。判別方法はまだ検討が必要かもしれません。)
* 読み込んだ図形の左上をキャンバスの左上に合わせるようにしました。

### TODO
* FireFoxでのクリップボードからの読み込み
* 曲線を自動的に折れ線化する

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
