// 全局变量
var gl;				// WebGL上下文
var program; 		// shader program

var mvStack = [];  // 模视投影矩阵栈，用数组实现，初始为空
var matCamera = mat4();	 // 照相机变换，初始为恒等矩阵
var matReverse = mat4(); // 照相机变换的逆变换，初始为恒等矩阵
var matProj;  // 投影矩阵

var yRot = 0.0;        // 用于动画的旋转角
var deltaAngle = 60.0; // 每秒旋转角度

// 用于保存W、S、A、D四个方向键的按键状态的数组
var keyDown = [false, false, false, false];

var g = 9.8;				// 重力加速度
var initSpeed = 4; 			// 初始速度 
var jumping = false;	    // 是否处于跳跃过程中
var jumpY = 0;          	// 当前跳跃的高度
var jumpTime = 0;			// 从跳跃开始经历的时间

//光源对象
//构造函数，各属性有默认值
var Light=function(){
	//光源位置/方向（默认为斜上方方向光源）
	this.pos = vec4(1.0,1.0,1.0,0.0);
	this.ambient = vec3(0.2,0.2,0.2);	//环境光
	this.diffuse = vec3(1.0,1.0,1.0);	//漫反射光
	this.specular = vec3(1.0,1.0,1.0);	//镜面反射光
	this.on = true;	//是否打开了光源
}

var lights = [];	//光源数组
var lightSun = new Light();	//使用默认光源属性
var lightRed = new Light();	//红色位置光源（模拟灯笼）
var lightYellow = new Light();	//黄色手电筒光源
var light1 = new Light();

//光源属性初始化
function initLights(){
	lights.push(lightSun);

	/*设置红色光源属性 */
	lightRed.pos = vec4(0.0,0.0,0.0,1.0);	//光源位置（建模坐标系）
	lightRed.ambient = vec3(1.0,1.0,1.0);	//环境光
	lightRed.diffuse = vec3(1.0,1.0,1.0);	//漫反射光
	lightRed.specular = vec3(1.0,1.0,1.0);	//镜面反射光
	lights.push(lightRed);

	/*设置手电筒光*/
	lightYellow.pos = vec4(0.0,0.0,0.0,1.0);	//光源位置（观察坐标系）
	lightYellow.ambient = vec3(0.0,0.0,0.0);	//照射面积小，不给环境光
	lightYellow.diffuse = vec3(1.0,1.0,0.0);	//漫反射光，黄色
	lightYellow.specular = vec3(1.0,1.0,0.0);	//镜面反射光，黄色
	lights.push(lightYellow);

	/*programObj中光源属性传值*/
	gl.useProgram(programObj);
	var ambientLight=[];
	ambientLight.push(lightSun.ambient);
	ambientLight.push(lightRed.ambient);
	ambientLight.push(lightYellow.ambient);
	gl.uniform3fv(programObj.u_AmbientProduct,flatten(ambientLight));

	var diffuseLight=[];
	diffuseLight.push(lightSun.diffuse);
	diffuseLight.push(lightRed.diffuse);
	diffuseLight.push(lightYellow.diffuse);
	gl.uniform3fv(programObj.u_DiffuseProduct,flatten(diffuseLight));

	var specularLight=[];
	specularLight.push(lightSun.specular);
	specularLight.push(lightRed.specular);
	specularLight.push(lightYellow.specular);
	gl.uniform3fv(programObj.u_SpecularProduct,flatten(specularLight));
	//给聚光灯参数传值
	gl.uniform3fv(programObj.u_SpotDirection, 
				flatten(vec3(0.0, 0.0, -1.0)));	//往z轴照
	gl.uniform1f(programObj.u_SpotCutOff, 8);	//设截止角
	gl.uniform1f(programObj.u_SpotExponent, 3);	//设衰弱指数

	//给聚光灯参数传值
	gl.useProgram(program);
	//给聚光灯参数传值
	gl.uniform3fv(program.u_SpotDirection,
		flatten(vec3(0.0,0.0,-1.0)));		//往负z轴照
	gl.uniform1f(program.u_SpotCutOff,8);	//设截止角
	gl.uniform1f(program.u_SpotExponent,3);	//设衰减指数
	
	passLightsOn();	//光源开关传值
}

//光源开关传值
function passLightsOn(){
	var lightsOn = [];
	for(var i = 0; i < lights.length;i++){
		if(lights[i].on)
			lightsOn[i]=1;
		else
			lightsOn[i]=0;
	}

	gl.useProgram(program);
	gl.uniform1iv(program.u_LightOn, lightsOn);
	
	gl.useProgram(programObj);
	gl.uniform1iv(programObj.u_LightOn, lightsOn);
	
}

//材质对象
//构造函数，各属性有默认值
var MaterialObj = function(){
	this.ambient = vec3(0.0,0.0,0.0);	//环境反射系数
	this.diffuse = vec3(0.8,0.8,0.8);		//漫反射系数
	this.specular = vec3(0.0,0.0,0.0);	//镜面反射系数
	this.emission = vec3(0.0,0.0,0.0);	//发射光
	this.shininess = 10;		//高光系数
	this.alpha = 1.0;			//透明度，默认完全不透明
}

//红色光源关闭时光源球使用的材质对象
var mtlRedLightOff = new MaterialObj();	
//设置光源球的材质属性
mtlRedLightOff.ambient = vec3(0.1,0.1,0.1);	//环境反射系数
mtlRedLightOff.diffuse = vec3(0.8,0.8,0.8);	//漫反射系数
mtlRedLightOff.specular = vec3(0.2,0.2,0.2);	//镜面反射系数
mtlRedLightOff.emission = vec3(0.5,0.5,0.5);	//发射光
mtlRedLightOff.shininess = 120;		//高光系数
mtlRedLightOff.alpha = 0.5;			//透明度

var mtlRedLight = new MaterialObj();	//红色光源球使用的材质对象
//设置光源球的材质属性
mtlRedLight.ambient = vec3(0.1,0.1,0.1);	//环境反射系数
mtlRedLight.diffuse = vec3(0.2,0.2,0.2);	//漫反射系数
mtlRedLight.specular = vec3(0.2,0.2,0.2);	//镜面反射系数
mtlRedLight.emission = vec3(1.0,1.0,1.0);	//发射光
mtlRedLight.shininess = 150;	//高光系数

var mtlL = new MaterialObj();
//设置光源球的材质属性
mtlL.ambient = vec3(0.1, 0.1, 0.1);//环境光系数
mtlL.diffuse = vec3(0.2, 0.2, 0.2);//漫反射光系数
mtlL.specular = vec3(0.1, 0.1, 0.1);//镜面反射光系数
mtlL.emission = vec3(0.81, 0.90, 1.0);//发射光
mtlL.shininess = 5;//高光系数


var mtlY = new MaterialObj();
//设置光源球的材质属性
mtlY.ambient = vec3(0.1, 0.1, 0.1);//环境光系数
mtlY.diffuse = vec3(0.2, 0.2, 0.2);//漫反射光系数
mtlY.specular = vec3(0.1, 0.1, 0.1);//镜面反射光系数
mtlY.emission = vec3(0.95, 0.83, 0.96);//发射光
mtlY.shininess = 5;//高光系数


var mtlH = new MaterialObj();
//设置光源球的材质属性
mtlH.ambient = vec3(0.1, 0.1, 0.1);//环境光系数
mtlH.diffuse = vec3(0.2, 0.2, 0.2);//漫反射光系数
mtlH.specular = vec3(0.1, 0.1, 0.1);//镜面反射光系数
mtlH.emission = vec3(0.75, 0.97, 0.85);//发射光
mtlH.shininess = 5;//高光系数


//纹理对象（自定义对象，并非WebGL的纹理对象）
var TextureObj = function(pathName,format,mipmapping){
	this.path = pathName;			//纹理图文件路径
	this.format = format;			//数据格式
	this.mipmapping = mipmapping;	//是否启用mipmapping
	this.texture = null;			//WebGL纹理对象
	this.complete = false;			//是否已完成文件加载
}

//创建纹理对象，加载纹理图
//参数为文件路径、纹理图格式（gl.RGB、gl.RGBA等）
//已经是否启用mipapping
//返回Texture对象
function loadTexture(path,format,mipmapping){
	var texObj=new TextureObj(path,format,mipmapping);

	var image=new Image();	//创建一个image对象
	if(!image){
		console.log("创建image对象失败！");
		return false;
	}

	//注册图像文件加载完毕时间的响应函数
	image.onload=function(){
		console.log("纹理图" + path + "加载完毕");

		//初始化纹理对象
		initTexture(texObj,image);

		textureLoaded++;	//增加已加载纹理数
		if(textureLoaded == numTextures)
			requestAnimFrame(render);	//请求重绘
	};

	//指定图像源，此时浏览器开始加载图像
	image.src=path;
	console.log("开始加载纹理图:"+path);
	
	return texObj;
}

//初始化纹理对象
function initTexture(texObj,image){
	texObj.texture = gl.createTexture();	//创建纹理对象
	if(!texObj.texture){
		console.log("创建纹理对象失败！");
		return false;
	}

	//绑定纹理对象
	gl.bindTexture(gl.TEXTURE_2D,texObj.texture);

	//在加载纹理图像时对其沿y轴反转
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); 

	//加载纹理图像
	gl.texImage2D(gl.TEXTURE_2D,0,texObj.format,
		texObj.format,gl.UNSIGNED_BYTE,image);

	if(texObj.mipmapping){//开启了mipmapping？
		//自动生成各级分辨率的纹理图
		gl.generateMipmap(gl.TEXTURE_2D);
		//设置插值方式
		gl.texParameteri(gl.TEXTURE_2D,
			gl.TEXTURE_MIN_FILTER,
			gl.LINEAR_MIPMAP_LINEAR);
	}
	else{
		gl.texParameteri(gl.TEXTURE_2D,
			gl.TEXTURE_MIN_FILTER,gl.LINEAR);
	}
	
	texObj.complete=true;	//纹理对象初始化完毕
}

// 定义Obj对象
// 构造函数
var Obj = function(){
	this.numVertices = 0; 				//顶点个数
	this.vertices = new Array(0); 		//用于保存顶点数据的数组
	this.normals = new Array(0);		//用于保存法向数据得数组
	this.texcoords = new Array(0);		//用于保存纹理坐标数据的数组
	this.vertexBuffer = null;			// 存放顶点数据的buffer对象
	this.normalBuffer = null;			//存放法向数据得buffer对象
	this.texBuffer = null;				//存放纹理坐标数据的buffer对象
	this.material = new MaterialObj();	//材质	
	this.texObj = null;					//Texture对象	
}	

// 初始化缓冲区对象(VBO)
Obj.prototype.initBuffers = function(){
	/*创建并初始化顶点坐标缓冲区对象(Buffer Object)*/
	// 创建缓冲区对象，存于成员变量vertexBuffer中
	this.vertexBuffer = gl.createBuffer(); 
	// 将vertexBuffer绑定为当前Array Buffer对象
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	// 为Buffer对象在GPU端申请空间，并提供数据
	gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
		flatten(this.vertices),		// 数据来源
		gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
		);
	// 顶点数据已传至GPU端，可释放内存
	this.vertices.length = 0; 

	/*创建并初始化顶点坐标缓冲区对象*/
	if(this.normals.length!=0){
		// 创建缓冲区对象，存于成员变量vertexBuffer中
		this.normalBuffer = gl.createBuffer(); 
		// 将normalBuffer绑定为当前Array Buffer对象
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		// 为Buffer对象在GPU端申请空间，并提供数据
		gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
			flatten(this.normals),		// 数据来源
			gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
			);
		// 顶点数据已传至GPU端，可释放内存
		this.normals.length = 0; 
	}

	/*创建并初始化顶点纹理坐标缓冲区对象(Buffer Object)*/
	if(this.texcoords.length != 0){
		// 创建缓冲区对象，存于成员变量texBuffer中
		this.texBuffer = gl.createBuffer(); 
		// 将texBuffer绑定为当前Array Buffer对象
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		// 为Buffer对象在GPU端申请空间，并提供数据
		gl.bufferData(gl.ARRAY_BUFFER,	// Buffer类型
			flatten(this.texcoords),	// 数据来源
			gl.STATIC_DRAW	// 表明是一次提供数据，多遍绘制
			);
		// 顶点数据已传至GPU端，可释放内存
		this.texcoords.length = 0;	
	}
}

//绘制几何对象
//参数为模视矩阵的和材质对象
Obj.prototype.draw = function(matMV,material,tmpTexObj){
	// 设置为a_Position提供数据的方式
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	// 为顶点属性数组提供数据(数据存放在vertexBuffer对象中)
	gl.vertexAttribPointer( 
		program.a_Position,	// 属性变量索引
		3,					// 每个顶点属性的分量个数
		gl.FLOAT,			// 数组数据类型
		false,				// 是否进行归一化处理
		0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
		0    // 第一个属性值在buffer中的偏移量
		);
	// 为a_Position启用顶点数组
	gl.enableVertexAttribArray(program.a_Position);	
	
	// 设置为a_Normal提供数据的方式
	if(this.normalBuffer != null){
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		// 为顶点属性数组提供数据(数据存放在vertexBuffer对象中)
		gl.vertexAttribPointer( 
			program.a_Normal,	// 属性变量索引
			3,					// 每个顶点属性的分量个数
			gl.FLOAT,			// 数组数据类型
			false,				// 是否进行归一化处理
			0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
			0    // 第一个属性值在buffer中的偏移量
			);
		// 为a_Position启用顶点数组
		gl.enableVertexAttribArray(program.a_Normal);	
	}
	
	// 设置为a_Normal提供数据的方式
	if(this.texBuffer != null){
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
		// 为顶点属性数组提供数据(数据存放在vertexBuffer对象中)
		gl.vertexAttribPointer( 
			program.a_Texcoord,	// 属性变量索引
			2,					// 每个顶点属性的分量个数
			gl.FLOAT,			// 数组数据类型
			false,				// 是否进行归一化处理
			0,   // 在数组中相邻属性成员起始位置间的间隔(以字节为单位)
			0    // 第一个属性值在buffer中的偏移量
			);
		// 为a_Position启用顶点数组
		gl.enableVertexAttribArray(program.a_Texcoord);	
	}
		
	var mtl;
	if(arguments.length>1 && arguments[1] !=null)	//提供了材质
		mtl=material;
	else
		mtl=this.material;

	//设置材质属性
	var ambientProducts=[];
	var diffuseProducts=[];
	var specularProducts=[];
	for(var i = 0;i < lights.length;i++){
		ambientProducts.push(mult(lights[i].ambient,
			mtl.ambient));
		diffuseProducts.push(mult(lights[i].diffuse,
			mtl.diffuse));
		specularProducts.push(mult(lights[i].specular,
			mtl.specular));
	}
	gl.uniform3fv(program.u_AmbientProduct,
		flatten(ambientProducts));
	gl.uniform3fv(program.u_DiffuseProduct,
		flatten(diffuseProducts));
	gl.uniform3fv(program.u_SpecularProduct,
		flatten(specularProducts));
	gl.uniform3fv(program.u_Emission,
		flatten(mtl.emission));
	gl.uniform1f(program.u_Shininess,mtl.shininess);
	gl.uniform1f(program.u_Alpaha,mtl.alpha);

	//参数有提供纹理对象则用参数提供的纹理对象，否则用对象自己的纹理对象
	var texObj;
	if(arguments.length > 2 && arguments[2] != null)
		texObj = tmpTexObj;
	else	
		texObj=this.texObj;

	//纹理对象不为空则绑定纹理对象
	if(texObj != null && texObj.complete){
		gl.bindTexture(gl.TEXTURE_2D,texObj.texture);
	}
	
	// 开始绘制
	gl.uniformMatrix4fv(program.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(program.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传法向矩阵
	gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);
}

// 在y=0平面绘制中心在原点的格状方形地面
// fExtent：决定地面区域大小(方形地面边长的一半)
// fStep：决定线之间的间隔
// 返回地面Obj对象
function buildGround(fExtent, fStep){	
	var obj = new Obj(); // 新建一个Obj对象
	var iterations = 2 * fExtent / fStep;	//单层循环次数
	var fTexcoordStep = 40 / iterations;		//纹理坐标递增步长
	for(var x = -fExtent,s = 0; x < fExtent; 
		x += fStep, s += fTexcoordStep){
		for(var z = fExtent, t = 0; z > -fExtent;
			 z -= fStep,t += fTexcoordStep){
			// 以(x, 0, z)为左下角的单元四边形的4个顶点
			var ptLowerLeft = vec3(x, 0, z);
			var ptLowerRight = vec3(x + fStep, 0, z);
			var ptUpperLeft = vec3(x, 0, z - fStep);
			var ptUpperRight = vec3(x + fStep, 0, z - fStep);
			
			// 分成2个三角形
			obj.vertices.push(ptUpperLeft);    
			obj.vertices.push(ptLowerLeft);
			obj.vertices.push(ptLowerRight);
			obj.vertices.push(ptUpperLeft);
			obj.vertices.push(ptLowerRight);
			obj.vertices.push(ptUpperRight);

			//顶点法向
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));
			obj.normals.push(vec3(0,1,0));

			//纹理坐标
			obj.texcoords.push(vec2(s,t + fTexcoordStep));
			obj.texcoords.push(vec2(s,t));
			obj.texcoords.push(vec2(s + fTexcoordStep, t ));
			obj.texcoords.push(vec2(s,t+fTexcoordStep));
			obj.texcoords.push(vec2(s + fTexcoordStep,t));
			obj.texcoords.push(vec2(s + fTexcoordStep,t + fTexcoordStep));
	
			obj.numVertices += 6;
		}
	}

	// 设置地面材质
	obj.material.ambient   = vec3(0.1, 0.1, 0.1); 	// 环境反射系数
	obj.material.diffuse   = vec3(0.8, 0.8, 0.8); 	// 漫反射系数
	obj.material.specular  = vec3(0.3, 0.3, 0.3); 	// 镜面反射系数
	obj.material.emission  = vec3(0.0, 0.0, 0.0); 	// 发射光
	obj.material.shininess = 10;					// 高光系数

	return obj;
}

// 用于生成一个中心在原点的球的顶点数据(南北极在z轴方向)
// 返回球Obj对象，参数为球的半径及经线和纬线数
function buildSphere(radius, columns, rows){
	var obj = new Obj(); // 新建一个Obj对象
	var vertices = []; // 存放不同顶点的数组

	for (var r = 0; r <= rows; r++){
		var v = r / rows;  // v在[0,1]区间
		var theta1 = v * Math.PI; // theta1在[0,PI]区间

		var temp = vec3(0, 0, 1);
		var n = vec3(temp); // 实现Float32Array深拷贝
		var cosTheta1 = Math.cos(theta1);
		var sinTheta1 = Math.sin(theta1);
		n[0] = temp[0] * cosTheta1 + temp[2] * sinTheta1;
		n[2] = -temp[0] * sinTheta1 + temp[2] * cosTheta1;
		
		for (var c = 0; c <= columns; c++){
			var u = c / columns; // u在[0,1]区间
			var theta2 = u * Math.PI * 2; // theta2在[0,2PI]区间
			var pos = vec3(n);
			temp = vec3(n);
			var cosTheta2 = Math.cos(theta2);
			var sinTheta2 = Math.sin(theta2);
			
			pos[0] = temp[0] * cosTheta2 - temp[1] * sinTheta2;
			pos[1] = temp[0] * sinTheta2 + temp[1] * cosTheta2;
			
			var posFull = mult(pos, radius);
			
			vertices.push(posFull);
		}
	}

	/*生成最终顶点数组数据(使用三角形进行绘制)*/
	var colLength = columns + 1;
	for (var r = 0; r < rows; r++){
		var offset = r * colLength;

		for (var c = 0; c < columns; c++){
			var ul = offset  +  c;						// 左上
			var ur = offset  +  c + 1;					// 右上
			var br = offset  +  (c + 1 + colLength);	// 右下
			var bl = offset  +  (c + 0 + colLength);	// 左下

			// 由两条经线和纬线围成的矩形
			// 分2个三角形来画
			obj.vertices.push(vertices[ul]); 
			obj.vertices.push(vertices[bl]);
			obj.vertices.push(vertices[br]);
			obj.vertices.push(vertices[ul]);
			obj.vertices.push(vertices[br]);
			obj.vertices.push(vertices[ur]);


			//球的法向与顶点坐标相同
			obj.normals.push(vertices[ul]);
			obj.normals.push(vertices[bl]);
			obj.normals.push(vertices[br]);
			obj.normals.push(vertices[ul]);
			obj.normals.push(vertices[br]);
			obj.normals.push(vertices[ur]);

			// 纹理坐标
			obj.texcoords.push(vec2(c / columns, r / rows)); 
			obj.texcoords.push(vec2(c / columns, (r+1) / rows));
			obj.texcoords.push(vec2((c+1) / columns, (r+1) / rows));
			obj.texcoords.push(vec2(c / columns, r / rows));
			obj.texcoords.push(vec2((c+1) / columns, (r+1) / rows));
			obj.texcoords.push(vec2((c+1) / columns, r / rows));
		}
	}

	vertices.length = 0; // 已用不到，释放 
	obj.numVertices = rows * columns * 6; // 顶点数
	
	
	obj.material.ambient = vec3(0.1, 0.1, 0.1); // 环境反射系数
	obj.material.diffuse = vec3(0.3, 0.3, 0.8); // 漫反射系数
	obj.material.specular = vec3(0.6, 0.6, 0.6);// 镜面反射系数
	obj.material.emission = vec3(0.0, 0.0, 0.0);// 发射光
	obj.material.shininess = 150;	// 高光系数
	return obj;
}

// 构建中心在原点的圆环(由线段构建)
// 参数分别为圆环的主半径(决定环的大小)，
// 圆环截面圆的半径(决定环的粗细)，
// numMajor和numMinor决定模型精细程度
// 返回圆环Obj对象
function buildTorus(majorRadius, minorRadius, numMajor, numMinor){
	var obj = new Obj(); // 新建一个Obj对象
	
	obj.numVertices = numMajor * numMinor * 6; // 顶点数

	var majorStep = 2.0 * Math.PI / numMajor;
	var minorStep = 2.0 * Math.PI / numMinor;
	var sScale = 4, tScale = 2;	//两方方向上纹理坐标的缩放系数

	for(var i = 0; i < numMajor; ++i){
		var a0 = i * majorStep;
		var a1 = a0 + majorStep;
		var x0 = Math.cos(a0);
		var y0 = Math.sin(a0);
		var x1 = Math.cos(a1);
		var y1 = Math.sin(a1);


		//三角形条带左右顶点（一个在下一个在上）对应的两个圆环中心
		var center0 = mult(majorRadius,vec3(x0,y0,0));
		var center1 = mult(majorRadius,vec3(x1,y1,0));

		for(var j = 0; j < numMinor; ++j){
			var b0 = j * minorStep;
			var b1 = b0 + minorStep;
			var c0 = Math.cos(b0);
			var r0 = minorRadius * c0 + majorRadius;
			var z0 = minorRadius * Math.sin(b0);
			var c1 = Math.cos(b1);
			var r1 = minorRadius * c1 + majorRadius;
			var z1 = minorRadius * Math.sin(b1);

			var left0 = vec3(x0*r0, y0*r0, z0);
			var right0 = vec3(x1*r0, y1*r0, z0);
			var left1 = vec3(x0*r1, y0*r1, z1);
			var right1 = vec3(x1*r1, y1*r1, z1);
			obj.vertices.push(left0);  
			obj.vertices.push(right0); 
			obj.vertices.push(left1); 
			obj.vertices.push(left1); 
			obj.vertices.push(right0);
			obj.vertices.push(right1);

			// 法向从圆环中心指向顶点
			obj.normals.push(subtract(left0, center0));
			obj.normals.push(subtract(right0, center1));
			obj.normals.push(subtract(left1, center0));
			obj.normals.push(subtract(left1, center0));
			obj.normals.push(subtract(right0, center1));
			obj.normals.push(subtract(right1, center1));
			
			// 纹理坐标
			obj.texcoords.push(vec2(i / numMajor * sScale, 
				j / numMinor * tScale));
			obj.texcoords.push(vec2((i+1) / numMajor * sScale, 
				j / numMinor * tScale));
			obj.texcoords.push(vec2(i / numMajor * sScale, 
				(j+1) / numMinor * tScale));
			obj.texcoords.push(vec2(i / numMajor * sScale, 
				(j+1) / numMinor * tScale));
			obj.texcoords.push(vec2((i+1) / numMajor * sScale, 
				j / numMinor * tScale));
			obj.texcoords.push(vec2((i+1) / numMajor * sScale, 
				(j+1) / numMinor * tScale));
		}
	}
	
	obj.material.ambient = vec3(0.1, 0.1, 0.1); // 环境反射系数
	obj.material.diffuse = vec3(0.9, 0.4, 0.4); // 漫反射系数
	obj.material.specular = vec3(0.4, 0.4, 0.4);// 镜面反射系数
	obj.material.emission = vec3(0.0, 0.0, 0.0);// 发射光
	obj.material.shininess = 80;				// 高光系数
	return obj;
}


function buildCube(w, l, h){
	var obj = new Obj(); // 新建一个Obj对象
	var vertices = [			// 立方体的8个顶点
		vec3(-l/2,-h/2, w/2), // 左下前
		vec3(-l/2, h/2, w/2), // 左上前
		vec3( l/2, h/2, w/2), // 右上前
		vec3( l/2,-h/2, w/2), // 右下前
		vec3(-l/2,-h/2,-w/2), // 左下后
		vec3(-l/2, h/2,-w/2), // 左上后
		vec3( l/2, h/2,-w/2), // 右上后
		vec3( l/2,-h/2,-w/2)  // 右下后
	];
    

	/*生成最终顶点数组数据(使用三角形进行绘制)*/
	//前
    obj.vertices.push(vertices[1]); 
	obj.vertices.push(vertices[0]);
	obj.vertices.push(vertices[3]);
	obj.vertices.push(vertices[1]);
	obj.vertices.push(vertices[3]);
	obj.vertices.push(vertices[2]);
	
	var u = subtract(vertices[0], vertices[1]);
	var v = subtract(vertices[3], vertices[0]);
    // 通过叉乘计算法向
	var normal = normalize(cross(u, v));
	obj.normals.push(normal); 
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	
	obj.texcoords.push(vec2(0.0,1.0)); 
	obj.texcoords.push(vec2(0.0,0.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(0.0,1.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(1.0,1.0));
	//右
	obj.vertices.push(vertices[2]); 
	obj.vertices.push(vertices[3]);
	obj.vertices.push(vertices[7]);
	obj.vertices.push(vertices[2]);
	obj.vertices.push(vertices[7]);
	obj.vertices.push(vertices[6]);
	
    u = subtract(vertices[3], vertices[2]);
	v = subtract(vertices[7], vertices[3]);
	normal = normalize(cross(u, v));
	obj.normals.push(normal); 
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);

	obj.texcoords.push(vec2(0.0,1.0)); 
	obj.texcoords.push(vec2(0.0,0.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(0.0,1.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(1.0,1.0));
	//下
    obj.vertices.push(vertices[3]); 
	obj.vertices.push(vertices[0]);
	obj.vertices.push(vertices[4]);
	obj.vertices.push(vertices[3]);
	obj.vertices.push(vertices[4]);
	obj.vertices.push(vertices[7]);
	
    u = subtract(vertices[0], vertices[3]);
	v = subtract(vertices[4], vertices[0]);
	normal = normalize(cross(u, v));
	obj.normals.push(normal); 
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	
	obj.texcoords.push(vec2(0.0,1.0)); 
	obj.texcoords.push(vec2(0.0,0.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(0.0,1.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(1.0,1.0));
	//上
	obj.vertices.push(vertices[6]); 
	obj.vertices.push(vertices[5]);
	obj.vertices.push(vertices[1]);
	obj.vertices.push(vertices[6]);
	obj.vertices.push(vertices[1]);
	obj.vertices.push(vertices[2]);
	
	u = subtract(vertices[5], vertices[6]);
	v = subtract(vertices[1], vertices[5]);
	normal = normalize(cross(u, v));
	obj.normals.push(normal); 
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	
	obj.texcoords.push(vec2(0.0,1.0)); 
	obj.texcoords.push(vec2(0.0,0.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(0.0,1.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(1.0,1.0));
	//前
    obj.vertices.push(vertices[4]); 
	obj.vertices.push(vertices[5]);
	obj.vertices.push(vertices[6]);
	obj.vertices.push(vertices[4]);
	obj.vertices.push(vertices[6]);
	obj.vertices.push(vertices[7]);
	
	u = subtract(vertices[5], vertices[4]);
	v = subtract(vertices[6], vertices[5]);
	normal = normalize(cross(u, v));
	obj.normals.push(normal); 
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	
	obj.texcoords.push(vec2(0.0,1.0)); 
	obj.texcoords.push(vec2(0.0,0.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(0.0,1.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(1.0,1.0));
	//右
	obj.vertices.push(vertices[5]); 
	obj.vertices.push(vertices[4]);
	obj.vertices.push(vertices[0]);
	obj.vertices.push(vertices[5]);
	obj.vertices.push(vertices[0]);
	obj.vertices.push(vertices[1]);
	
	u = subtract(vertices[4], vertices[5]);
	v = subtract(vertices[0], vertices[4]);
	normal = normalize(cross(u, v));
	obj.normals.push(normal); 
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	obj.normals.push(normal);
	
	obj.texcoords.push(vec2(0.0,1.0)); 
	obj.texcoords.push(vec2(0.0,0.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(0.0,1.0));
	obj.texcoords.push(vec2(1.0,0.0));
	obj.texcoords.push(vec2(1.0,1.0));

	vertices.length = 0; // 已用不到，释放 
	obj.numVertices = 36; // 顶点数
	
 	obj.material.ambient=vec3(0.2,0.2,0.2);//环境反射系数
	obj.material.diffuse=vec3(0.5,0.5,0.5);//漫反射系数
	obj.material.specular=vec3(0.8,0.8,0.8);//镜面反射系数
	obj.material.emission=vec3(0.5, 0.5, 0.5);//发射光
	obj.material.shininess=10;//高光系数 
	
	return obj;
}

// 获取shader中变量位置
function getLocation(){
	/*获取shader中attribute变量的位置(索引)*/
    program.a_Position = gl.getAttribLocation(program, "a_Position");
	if(program.a_Position < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Position失败！"); 
	}	
	program.a_Normal = gl.getAttribLocation(program, "a_Normal");
	if(program.a_Normal < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Normal失败！"); 
	}	
	program.a_Texcoord = gl.getAttribLocation(program, "a_Texcoord");
	if(program.a_Texcoord < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Texcoord失败！"); 
	}
	
	/*获取shader中uniform变量的位置(索引)*/
	program.u_ModelView = gl.getUniformLocation(program, "u_ModelView");
	if(!program.u_ModelView){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_ModelView失败！"); 
	}	
	program.u_Projection = gl.getUniformLocation(program, "u_Projection");
	if(!program.u_Projection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Projection失败！"); 
	}
	program.u_NormalMat = gl.getUniformLocation(program, "u_NormalMat");
	if(!program.u_NormalMat){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_NormalMat失败！"); 
	}	
	program.u_LightPosition = gl.getUniformLocation(program, "u_LightPosition");
	if(!program.u_LightPosition){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightPosition失败！"); 
	}

	program.u_Shininess = gl.getUniformLocation(program, "u_Shininess");
	if(!program.u_Shininess){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Shininess失败！"); 
	}	
	program.u_AmbientProduct = gl.getUniformLocation(program, "u_AmbientProduct");
	if(!program.u_AmbientProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_AmbientProduct失败！"); 
	}
	program.u_DiffuseProduct = gl.getUniformLocation(program, "u_DiffuseProduct");
	if(!program.u_DiffuseProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_DiffuseProduct失败！"); 
	}	
	program.u_SpecularProduct = gl.getUniformLocation(program, "u_SpecularProduct");
	if(!program.u_SpecularProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpecularProduct失败！"); 
	}
	program.u_Emission = gl.getUniformLocation(program, "u_Emission");
	if(!program.u_Emission){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Emission失败！"); 
	}

	program.u_SpotDirection = gl.getUniformLocation(program, "u_SpotDirection");
	if(!program.u_SpotDirection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotDirection失败！"); 
	}	
	program.u_SpotCutOff = gl.getUniformLocation(program, "u_SpotCutOff");
	if(!program.u_SpotCutOff){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotCutOff失败！"); 
	}
	program.u_SpotExponent = gl.getUniformLocation(program, "u_SpotExponent");
	if(!program.u_SpotExponent){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotExponent失败！"); 
	}
	program.u_LightOn = gl.getUniformLocation(program, "u_LightOn");
	if(!program.u_LightOn){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightOn失败！"); 
	}
	program.u_Sampler = gl.getUniformLocation(program, "u_Sampler");
	if(!program.u_Sampler){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Sampler失败！"); 
	}
	program.u_Alpaha = gl.getUniformLocation(program, "u_Alpaha");
	if(!program.u_Alpaha){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Alpaha失败！"); 
	}
	program.u_bOnlyTexture = gl.getUniformLocation(program, "u_bOnlyTexture");
	if(!program.u_bOnlyTexture){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_bOnlyTexture失败！"); 
	}

	/*获取programObj中的attribute变量的位置（索引）*/
	attribIndex.a_Position = gl.getAttribLocation(programObj, "a_Position");
	if(attribIndex.a_Position < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Position失败！"); 
	}	
	attribIndex.a_Normal = gl.getAttribLocation(programObj, "a_Normal");
	if(attribIndex.a_Normal < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Normal失败！"); 
	}	
	attribIndex.a_Texcoord = gl.getAttribLocation(programObj, "a_Texcoord");
	if(attribIndex.a_Texcoord < 0){ // getAttribLocation获取失败则返回-1
		console.log("获取attribute变量a_Texcoord失败！"); 
	}

	
	//新
	mtlIndex.u_Ka = gl.getUniformLocation(programObj, "u_Ka");
	if(!mtlIndex.u_Ka){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ka失败！"); 
	}
	mtlIndex.u_Kd = gl.getUniformLocation(programObj, "u_Kd");
	if(!mtlIndex.u_Kd){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Kd失败！"); 
	}
	mtlIndex.u_Ks = gl.getUniformLocation(programObj, "u_Ks");
	if(!mtlIndex.u_Ks){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ks失败！"); 
	}
	mtlIndex.u_Ke = gl.getUniformLocation(programObj, "u_Ke");
	if(!mtlIndex.u_Ke){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ke失败！"); 
	}
	mtlIndex.u_Ns = gl.getUniformLocation(programObj, "u_Ns");
	if(!mtlIndex.u_Ns){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Ns失败！"); 
	}
	mtlIndex.u_d = gl.getUniformLocation(programObj, "u_d");
	if(!mtlIndex.u_d){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_d失败！"); 
	}
	programObj.u_ModelView = gl.getUniformLocation(programObj, "u_ModelView");
	if(!programObj.u_ModelView){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_ModelView失败！"); 
	}	
	programObj.u_Projection = gl.getUniformLocation(programObj, "u_Projection");
	if(!programObj.u_Projection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Projection失败！"); 
	}
	programObj.u_NormalMat = gl.getUniformLocation(programObj, "u_NormalMat");
	if(!programObj.u_NormalMat){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_NormalMat失败！"); 
	}	
	programObj.u_LightPosition = gl.getUniformLocation(programObj, "u_LightPosition");
	if(!programObj.u_LightPosition){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightPosition失败！"); 
	}
	programObj.u_AmbientProduct = gl.getUniformLocation(programObj, "u_AmbientProduct");
	if(!programObj.u_AmbientProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_AmbientProduct失败！"); 
	}
	programObj.u_DiffuseProduct = gl.getUniformLocation(programObj, "u_DiffuseProduct");
	if(!programObj.u_DiffuseProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_DiffuseProduct失败！"); 
	}	
	programObj.u_SpecularProduct = gl.getUniformLocation(programObj, "u_SpecularProduct");
	if(!programObj.u_SpecularProduct){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpecularProduct失败！"); 
	}
	programObj.u_SpotDirection = gl.getUniformLocation(programObj, "u_SpotDirection");
	if(!programObj.u_SpotDirection){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotDirection失败！"); 
	}
	programObj.u_SpotCutOff = gl.getUniformLocation(programObj, "u_SpotCutOff");
	if(!programObj.u_SpotCutOff){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotCutOff失败！"); 
	}
	programObj.u_SpotExponent = gl.getUniformLocation(programObj, "u_SpotExponent");
	if(!programObj.u_SpotExponent){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_SpotExponent失败！"); 
	}
	programObj.u_LightOn = gl.getUniformLocation(programObj, "u_LightOn");
	if(!programObj.u_LightOn){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_LightOn失败！"); 
	}
	programObj.u_Sampler = gl.getUniformLocation(programObj, "u_Sampler");
	if(!programObj.u_Sampler){ // getUniformLocation获取失败则返回null
		console.log("获取uniform变量u_Sampler失败！"); 
	}
	
}

var ground = buildGround(20.0, 0.1); // 生成地面对象


var numSpheres = 25;  // 场景中球的数目

var numCube = 12;
var posCube = [];
//todo
var Long=0.2,Width=0.2,posHight=[];

// 用于保存球位置的数组，对每个球位置保存其x、z坐标
var posSphere = [];  
var sphere = buildSphere(0.2, 15, 15); // 生成球对象

var torus = buildTorus(0.15, 0.05, 60, 20); // 生成圆环对象

var cube = buildCube(1, 1, 1);

var cubeObj;//正方形

var lightTexObj;	//红色光源球所使用的纹理对象
var skyTexObj;		//天空球使用的纹理对象
var LTexObj;
var YTexObj;
var HTexObj;


var textureLoaded = 0;	//已加载完毕的纹理图
var numTextures = 8;	//纹理图总数

//开始读取Obj模型（异步方式），返回OBJModel对象
var obj = loadOBJ("Res\\tress1.obj");
var obja = loadOBJ("Res\\stone.obj");

var programObj;		//obj模型绘制所使用的program
var attribIndex = new AttribIndex();//programObj中attribute变量索引
var mtlIndex = new MTLIndex();		//programObj中材质变量索引

// 初始化场景中的几何对象
function initObjs(){
	// 初始化地面顶点数据缓冲区对象(VBO)
	ground.initBuffers(); 
	//初始化地面纹理，纹理图为RGB图像，先不使用Mipampping
	ground.texObj = loadTexture("Res\\ground.bmp",gl.RGB,true);
	
	var sizeGround = 20;
	// 随机放置球的位置
	for(var iSphere = 0; iSphere < numSpheres; iSphere++){
		// 在 -sizeGround 和 sizeGround 间随机选择一位置
		var x = Math.random() * sizeGround * 2 - sizeGround;
		var z = Math.random() * sizeGround * 2 - sizeGround;
		posSphere.push(vec2(x, z));
	}
	var i=0;
	// 随机放置长方体的位置
	for(var iCube = 0; iCube < numCube; iCube++){
		i+=sizeGround / (2 * numCube);//把位置分段
		// 随机选择一位置[0-sizeGround]
		var x = i ;
		posCube.push(x);
		var r=Math.random()*0.5;
		posHight.push(r);
	}
	
	// 初始化球顶点数据缓冲区对象(VBO)
	sphere.initBuffers();
	sphere.texObj = loadTexture("Res\\sphere.jpg",gl.RGB,true);
	
	// 初始化圆环顶点数据缓冲区对象(VBO)
	torus.initBuffers();
	torus.texObj=loadTexture("Res\\torus.jpg",gl.RGB,true);
	
	cube.initBuffers();
	cube.texObj = loadTexture("Res\\sphere.jpg", gl.RGB, true);
	
	lightTexObj = loadTexture("Res\\sun.jpg", gl.RGB, true);
	
	skyTexObj=loadTexture("Res\\sky.jpg",gl.RGB,true);
	
	LTexObj = loadTexture("Res\\L.jpg",gl.RGB,true);
	YTexObj = loadTexture("Res\\Y.jpg",gl.RGB,true);
	HTexObj = loadTexture("Res\\H.jpg",gl.RGB,true);
}

var isgame = false;

// 页面加载完成后会调用此函数，函数名可任意(不一定为main)
window.onload = function main(){
	// 获取页面中id为webgl的canvas元素
    var canvas = document.getElementById("webgl");
	if(!canvas){ // 获取失败？
		alert("获取canvas元素失败！"); 
		return;
	}
	
	// 利用辅助程序文件中的功能获取WebGL上下文
	// 成功则后面可通过gl来调用WebGL的函数
    gl = WebGLUtils.setupWebGL(canvas,{alpha:false});    
    if (!gl){ // 失败则弹出信息
		alert("获取WebGL上下文失败！"); 
		return;
	}        

	/*设置WebGL相关属性*/
    gl.clearColor(0.0, 0.0, 0.5, 1.0); // 设置背景色为蓝色
	gl.enable(gl.DEPTH_TEST);	// 开启深度检测
	gl.enable(gl.CULL_FACE);	// 开启面剔除
	// 设置视口，占满整个canvas
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.BLEND); // 开启混合
	// 设置混合方式
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	/*加载shader程序并为shader中attribute变量提供数据*/
	// 加载id分别为"vertex-shader"和"fragment-shader"的shader程序，
	// 并进行编译和链接，返回shader程序对象program
    program = initShaders(gl, "vertex-shader", 
		"fragment-shader");
	//编译链接新的shader程序对象，使用的钉钉shader和上面一样，
	//但片元shader不同
	programObj=initShaders(gl,"vertex-shader",
		"fragment-shaderNew");
    gl.useProgram(program);	// 启用该shader程序对象 
	
	// 获取shader中变量位置
	getLocation();	
		
	// 设置投影矩阵：透视投影，根据视口宽高比指定视域体
	var matProj = perspective(45.0, 	// 垂直方向视角
		canvas.width / canvas.height, 	// 视域体宽高比
		0.1, 							// 相机到近裁剪面距离
		100.0);							// 相机到远裁剪面距离

	//传投影矩阵
	gl.uniformMatrix4fv(program.u_Projection,false,flatten(matProj));
	
	//game
	var gameButton=document.getElementById("game");
	gameButton.onclick=function(){
		isgame = true;
		matCamera=mat4();
		matMV = mult(translate(0, -jumpY, 0), matCamera);
	}
	
	//本程序只用了0号纹理单元
	gl.uniform1i(program.u_Sampler,0);

	gl.useProgram(programObj);
	
	gl.uniformMatrix4fv(programObj.u_Projection,false,flatten(matProj));

	initLights();
		
	// 初始化场景中的几何对象
	initObjs();
	
	canvas.onclick = function(){		// 鼠标点击事件
		canvas.requestPointerLock();
		}	// 请求指针锁定
	canvas.onmousemove=function(){
		if(document.pointerLockElement){
			devX = event.movementX;
			devY = event.movementY;
			//console.log(role.point);
		}
	}
	
	// 进行绘制
    //render();
};


var yTtanslateL = 0.4;//球初始时的y轴方向
var yTtanslateY = 0.6;//球初始时的y轴方向
var yTtanslateH = 0.3;//球初始时的y轴方向

// 按键响应
window.onkeydown = function(){
	switch(event.keyCode){
		case 49:	//'1'
			lights[0].on = !lights[0].on;
			passLightsOn();
			break;
		case 50:	//'2'
			lights[1].on = !lights[1].on;
			passLightsOn();
			break;
		case 51:	//'3'
			lights[2].on = !lights[2].on;
			passLightsOn();
			break;
		case 38:	// Up
			matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
			matCamera = mult(translate(0.0, 0.0, 0.1), matCamera);
			break;
		case 40:	// Down
			matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
			matCamera = mult(translate(0.0, 0.0, -0.1), matCamera);
			break;
		case 37:	// Left
			matReverse = mult(matReverse, rotateY(1));
			matCamera = mult(rotateY(-1), matCamera);
			break;
		case 39:	// Right
			matReverse = mult(matReverse, rotateY(-1));
			matCamera = mult(rotateY(1), matCamera);
			break;
		case 87:	// W
			keyDown[0] = true;
			break;
		case 83:	// S
			keyDown[1] = true;
			break;
		case 65:	// A
			keyDown[2] = true;
			break;
		case 68:	// D
			keyDown[3] = true;
			break;
		case 32: 	// space
			if(!jumping){
				jumping = true;
				jumpTime = 0;
			}
			break;
		case 76:
		case 108:
			if(isgame == true){
				yTtanslateL = yTtanslateL + 0.1;	
			}
			break;
		case 89:
		case 121:
			if(isgame == true){
				yTtanslateY = yTtanslateY + 0.1;
			}
			break;
		case 72:
		case 104:
			if(isgame == true){
				yTtanslateH = yTtanslateH + 0.1;
			}
			break;
		case 17:	//ctrl
			jumpY = -0.3;
			break;
	}
	// 禁止默认处理(例如上下方向键对滚动条的控制)
	event.preventDefault(); 
	//console.log("%f, %f, %f", matReverse[3], matReverse[7], matReverse[11]);
}

// 按键弹起响应
window.onkeyup = function(){
	switch(event.keyCode){
		case 87:	// W
			keyDown[0] = false;
			break;
		case 83:	// S
			keyDown[1] = false;
			break;
		case 65:	// A
			keyDown[2] = false;
			break;
		case 68:	// D
			keyDown[3] = false;
			break;
		case 17:
			jumpY = 0;
			break;
	}
}

var isover = true;

// 记录上一次调用函数的时刻
var last = Date.now();

// 根据时间更新旋转角度
function animation(){
	// 计算距离上次调用经过多长的时间
	var now = Date.now();
	var elapsed = (now - last) / 1000.0; // 秒
	last = now;
	
	// 更新动画状态
	yRot += deltaAngle * elapsed;

	// 防止溢出
    yRot %= 360;
	
	// 跳跃处理
	jumpTime += elapsed;
	if(jumping){
		jumpY = initSpeed * jumpTime - 0.5 * g * jumpTime * jumpTime;
		if(jumpY <= 0){
			jumpY = 0;
			jumping = false;
		}
	}
	
	if(isgame==true){	
		
		yTtanslateL = yTtanslateL - 0.005;
		yTtanslateY = yTtanslateY - 0.005;
		yTtanslateH = yTtanslateH - 0.005;
		
		if(yTtanslateL <= -0.4 || yTtanslateY <= -0.4 || yTtanslateH <= -0.4 ||
				yTtanslateL >= 1.0 || yTtanslateY >= 1.0 || yTtanslateH >= 1.0){
			alert("Game over");
			isgame = false;
			isover = true;
		}
		
	}
	
	
}

var devX = 0;
var devY = 0;
var totalAngleLevelCamera = 0.0;
var totalAngleVerticalCamera = 0.0;
var speedCamera = 0.1;
var speedBullet = 30.0;
var verticalViewRange = 30.0;


// 更新照相机变换
function updateCamera(){
	// 照相机前进
	if(keyDown[0]){
		matReverse = mult(matReverse, translate(0.0, 0.0, -0.1));
		matCamera = mult(translate(0.0, 0.0, 0.1), matCamera);
	}
	
	// 照相机后退
	if(keyDown[1]){
		matReverse = mult(matReverse, translate(0.0, 0.0, 0.1));
		matCamera = mult(translate(0.0, 0.0, -0.1), matCamera);
	}
	
	// 照相机左转
	if(keyDown[2]){
		matReverse = mult(matReverse, rotateY(1));
		matCamera = mult(rotateY(-1), matCamera);
	}
	
	// 照相机右转
	if(keyDown[3]){
		matReverse = mult(matReverse, rotateY(-1));
		matCamera = mult(rotateY(1), matCamera);
	}
	
	var AngleL = devX / 1200 * 360;
	var AngleV = -devY / 1200 * 360;
	
	matReverse = mult(matReverse, rotateX(-totalAngleVerticalCamera));
	matReverse = mult(matReverse, rotateY(-AngleL));
	matCamera = mult(rotateX(totalAngleVerticalCamera), matCamera);
	matCamera = mult(rotateY(AngleL), matCamera);
	
	
	totalAngleLevelCamera += AngleL;
	totalAngleVerticalCamera += AngleV;
	if(totalAngleVerticalCamera > verticalViewRange)
		totalAngleVerticalCamera = verticalViewRange;
	else if(totalAngleVerticalCamera < -verticalViewRange)
		totalAngleVerticalCamera = -verticalViewRange;
	
	matReverse = mult(matReverse, rotateX(totalAngleVerticalCamera));
	matCamera = mult(rotateX(-totalAngleVerticalCamera), matCamera);
	
	if(speedCamera < 0){
		speedCamera *= -1;
	}
	devX = devY = 0;
	
}

var rad = Math.random();

// 绘制函数
function render() {
	//检查是否一切就绪，否则请求重绘，并返回
	//这样稍后系统又会调用render重新检查相关状态
	if(!obj.isAllReady(gl)){
		requestAnimFrame(render);	//请求重绘
		return;	//返回
	}
	if(!obja.isAllReady(gl)){
		requestAnimFrame(render);	//请求重绘
		return;	//返回
	}
	

	animation(); // 更新动画参数
	
	updateCamera(); // 更新相机变换
	
	// 清颜色缓存和深度缓存
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
   
    // 模视投影矩阵初始化为投影矩阵*照相机变换矩阵
	var matMV = mult(translate(0,-jumpY,0),matCamera);	

	var lightPositions=[];		//光源位置数组
	//决定旋转球位置的变换
	var matRotatingSphere = mult(matMV,mult(translate(0.0,0.0,-2.5),
		mult(rotateY(-yRot * 2.0),translate(1.0,0.0,0.0))));
	lightPositions.push(mult(matMV,lightSun.pos));
	lightPositions.push(mult(matRotatingSphere,lightRed.pos));
	lightPositions.push(lightYellow.pos);

	//传观察坐标系下光源位置/方向
	gl.useProgram(program);
	gl.uniform4fv(program.u_LightPosition,
		flatten(lightPositions));

	gl.useProgram(programObj);
	gl.uniform4fv(programObj.u_LightPosition,
		flatten(lightPositions));

	/*绘制Obj模型*/
	gl.useProgram(programObj);
	mvStack.push(matMV); 
	matMV = mult(matMV, translate(0.6, -0.35, -0.5));
	matMV = mult(matMV, scale(0.0007, 0.0007, 0.0007));
	gl.uniformMatrix4fv(programObj.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(programObj.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传法向矩阵
	obj.draw(gl, attribIndex, mtlIndex, programObj.u_Sampler);
	matMV = mvStack.pop();
	
	
	
	
	/*绘制Obj模型*/
	gl.useProgram(programObj);
	mvStack.push(matMV); 
	matMV = mult(matMV, translate(0.3, -0.40, -1.05));
	matMV = mult(matMV, scale(0.005, 0.005, 0.005));
	matMV=mult(matMV,rotateY(90));
	gl.uniformMatrix4fv(programObj.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(programObj.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传法向矩阵
	obja.draw(gl, attribIndex, mtlIndex, programObj.u_Sampler);
	matMV = mvStack.pop();
	/*绘制Obj模型*/
	gl.useProgram(programObj);
	mvStack.push(matMV); 
	matMV = mult(matMV, translate(-0.3, -0.40, -1.05));
	matMV = mult(matMV, scale(0.005, 0.005, 0.005));
	matMV=mult(matMV,rotateY(90));
	gl.uniformMatrix4fv(programObj.u_ModelView, false, 
		flatten(matMV)); // 传MV矩阵
	gl.uniformMatrix3fv(programObj.u_NormalMat, false, 
		flatten(normalMatrix(matMV))); // 传法向矩阵
	obja.draw(gl, attribIndex, mtlIndex, programObj.u_Sampler);
	matMV = mvStack.pop();
	
	
	gl.useProgram(program);		//后面这些对象使用的都是这个program
	/*绘制天空球*/
	gl.disable(gl.CULL_FACE);	//关闭背面剔除
	mvStack.push(matMV);	//不让天空球的变换影响到后面的对象
	matMV=mult(matMV,scale(150.0,150.0,150.0));	//放大到足够大
	matMV=mult(matMV,rotateX(90));		//调整南北极
	gl.uniform1i(program.u_bOnlyTexture,1);	//让u_bOnlyTexture为真
	//绘制天空球，材质无所谓，因为关闭了光照计算
	//使用天空球的纹理
	sphere.draw(matMV,null,skyTexObj);
	gl.uniform1i(program.u_bOnlyTexture,0);	//让u_bOnlyTexture为假
	matMV=mvStack.pop();
	gl.enable(gl.CULL_FACE);//重新开启背面剔除

	/*绘制地面*/
	mvStack.push(matMV);
	// 将地面移到y=-0.4平面上
	matMV = mult(matMV, translate(0.0, -0.5, 0.0));
	ground.draw(matMV);
	matMV = mvStack.pop();
	
	//正方体
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, -0.49, -2.2));
	matMV = mult(matMV, scale(2.5, 0.01, 2.4));
	cube.draw(matMV);
	matMV = mvStack.pop();
	//正方体
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, 0.95, -2.2));
	matMV = mult(matMV, scale(2.5, 0.01, 2.4));
	cube.draw(matMV);
	matMV = mvStack.pop();
	//正方体
	mvStack.push(matMV);
	matMV = mult(matMV, translate(1.25, 0.0, -3.0));
	matMV = mult(matMV, scale(0.01, 1.9, 0.43));
	cube.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(1.25, 0.0, -2.2));
	matMV = mult(matMV, scale(0.01, 1.9, 0.43));
	cube.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(1.25, 0.0, -1.4));
	matMV = mult(matMV, scale(0.01, 1.9, 0.43));
	cube.draw(matMV);
	matMV = mvStack.pop();
	//正方体
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-1.25, 0.0, -3.0));
	matMV = mult(matMV, scale(0.01, 1.9, 0.43));
	cube.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-1.25, 0.0, -2.2));
	matMV = mult(matMV, scale(0.01, 1.9, 0.43));
	cube.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-1.25, 0.0, -1.4));
	matMV = mult(matMV, scale(0.01, 1.9, 0.43));
	cube.draw(matMV);
	matMV = mvStack.pop();
	
	/*绘制每个球体*/
	for(var i = 0; i < numSpheres; i++){
		mvStack.push(matMV);
		matMV = mult(matMV, translate(posSphere[i][0],
			-0.4, posSphere[i][1])); // 平移到相应位置
		if(Math.random()>0.5)
			matMV = mult(matMV, rotateY(-yRot * 3.0));
		else
			matMV = mult(matMV, rotateY(yRot * 2.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		sphere.draw(matMV);
		matMV = mvStack.pop();
	}
	
	/*绘制每个球体*/
	for(var i = 0; i < numSpheres; i++){
		mvStack.push(matMV);
		matMV = mult(matMV, translate(posSphere[i][1],
			0.1, posSphere[i][0])); // 平移到相应位置
			if(Math.random()>0.5)
			matMV = mult(matMV, rotateY(-yRot * 2.5));
		else
			matMV = mult(matMV, rotateY(yRot * 1.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		sphere.draw(matMV);
		matMV = mvStack.pop();
	}
	
	// 将后面的模型往-z轴方向移动
	// 使得它们位于摄像机前方(也即世界坐标系原点前方)
	matMV = mult(matMV, translate(0.0, 0.0, -2.5));
	
	/*绘制自转的圆环*/
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.0, 0.1, -0.2));
	matMV = mult(matMV, rotateY(-yRot));
	torus.draw(matMV);
	matMV = mvStack.pop();
	/*绘制自转的圆环*/
	mvStack.push(matMV);
	matMV = mult(matMV, translate(0.7, -0.1, -0.2));
	matMV = mult(matMV, rotateY(yRot));
	torus.draw(matMV);
	matMV = mvStack.pop();
	mvStack.push(matMV);
	matMV = mult(matMV, translate(-0.7, -0.1, -0.2));
	matMV = mult(matMV, rotateY(yRot));
	torus.draw(matMV);
	matMV = mvStack.pop();
	

	/*绘制绕原点旋转的球*/
	mvStack.push(matMV); // 使得下面对球的变换不影响后面绘制的圆环
	// 调整南北极后先旋转再平移
	matMV = mult(matMV, rotateY(-yRot * 0.8));
	matMV = mult(matMV, translate(1.0, 1.2, -0.1));
	matMV = mult(matMV, rotateX(90)); // 调整南北极
				
	if(lights[1].on)//红
		sphere.draw(matMV,mtlRedLight,lightTexObj);
	else
		sphere.draw(matMV,mtlRedLightOff, lightTexObj);
	matMV = mvStack.pop();
	
	/*绘制绕原点旋转的球*/
	mvStack.push(matMV); // 使得下面对球的变换不影响后面绘制的圆环
	// 调整南北极后先旋转再平移
	matMV = mult(matMV, rotateY(yRot * 1.0));
	matMV = mult(matMV, translate(1.0, 1.2, 0.2));
	matMV = mult(matMV, rotateX(90)); // 调整南北极
				
	if(lights[1].on)//红
		sphere.draw(matMV,mtlRedLight,lightTexObj);
	else
		sphere.draw(matMV,mtlRedLightOff, lightTexObj);
	matMV = mvStack.pop();
	
	
	if(isgame==true && isover == true){ 
		 
		mvStack.push(matMV); // 使得下面对球的变换不影响后面绘制的圆环
		// 调整南北极后先旋转再平移
		//matMV = mult(matMV, rotateY(yRot * 0.2));
		matMV = mult(matMV, translate(-0.6, yTtanslateL, 0.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		matMV = mult(matMV, rotateZ(-90)); // 调整南北极
		sphere.draw(matMV, mtlL, LTexObj);
	    matMV = mvStack.pop();
		
		mvStack.push(matMV); // 使得下面对球的变换不影响后面绘制的圆环
		// 调整南北极后先旋转再平移
		//matMV = mult(matMV, rotateY(yRot * 0.2));
		matMV = mult(matMV, translate(0.0, yTtanslateY, 0.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		matMV = mult(matMV, rotateZ(-90)); // 调整南北极
		sphere.draw(matMV, mtlY, YTexObj);
	    matMV = mvStack.pop();
		
		mvStack.push(matMV); // 使得下面对球的变换不影响后面绘制的圆环
		// 调整南北极后先旋转再平移
		//matMV = mult(matMV, rotateY(yRot * 0.2));
		matMV = mult(matMV, translate(0.6, yTtanslateH, 0.0));
		matMV = mult(matMV, rotateX(90)); // 调整南北极
		matMV = mult(matMV, rotateZ(-90)); // 调整南北极
		sphere.draw(matMV, mtlH, HTexObj);
	    matMV = mvStack.pop();
		
	}
	
	requestAnimFrame(render); // 请求重绘
}