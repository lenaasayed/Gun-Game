import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import * as TextureUtils from '../common/texture-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4, quat } from 'gl-matrix';
import { CheckBox } from '../common/dom-utils';
import { createElement } from 'tsx-create-element';
import { Key } from 'ts-key-enum'
// This function creates a triangle wave, this is used to move the house model
function triangle(x: number): number {
    let i = Math.floor(x);
    return (i%2==0)?(x-i):(1+i-x);
}

// This is an interface for 3D object, you can think of it as C++ structs in this code (but they are generally different)



interface Object3D {
    mesh: Mesh; // which mesh to draw
    texture: WebGLTexture; // which texture to attach
    tint: [number, number, number, number], // the color tint of the object
    currentModelMatrix: mat4, // The model matrix of the object in the current frame
    previousModelMatrix: mat4 // The model matrix of the object in the previous frame
};

// In this scene we will draw a scene to multiple targets then use the targets to do a motion blur post processing
export default class GameOneScene extends Scene {


    
    programs: { [name: string]: ShaderProgram } = {}; // This will hold all our shders
    camera: Camera;
    controller: FlyCameraController;
    meshes: { [name: string]: Mesh } = {}; // This will hold all our meshes
    textures: { [name: string]: WebGLTexture } = {}; // This will hold all our textures
    samplers: { [name: string]: WebGLSampler } = {}; // This will hold all our samplers
    frameBuffer: WebGLFramebuffer; // This will hold the frame buffer object
//////////////////************************ */
material = {
    diffuse: vec3.fromValues(0.5,0.3,0.1),
    specular: vec3.fromValues(0.1,1,1),
    ambient: vec3.fromValues(3.5,0.3,0.1),
    shininess: 20
};

light = {
    diffuse: vec3.fromValues(100,100,100),
    specular: vec3.fromValues(1,11,1),
    ambient: vec3.fromValues(0,12,17),
    position: vec3.fromValues(5, 4, -25),
    attenuation_quadratic: 1,
    attenuation_linear: 0,
    attenuation_constant: 0
};
//////////////////////********************** */
objects: {[name: string]: Object3D} = {}; // This will hold all our 3D objects
VP_prev: mat4; // This will hold the ViewProjection matrix of the camera in the previous frame
score1:Object3D;
score2:Object3D;
score3:Object3D;
score4:Object3D;
score5:Object3D;
score1delet:Object3D;
score2delet:Object3D;
score3delet:Object3D;
score4delet:Object3D;
score5delet:Object3D;
win :Object3D;
gameover:Object3D;
    motionBlurEnabled: boolean = true; // Whether motion blur is enabled or not

    time: number = 0; // The time in the scene
    paused: boolean = false; // Whether the time is paused or 
    counter:number=0; 
    bullet_speed:number=0.6;
    x_at_shoot:number=0;
    num_of_bullet:number=21;
    checkmoon:number=1;         
    mx:number=0;
    my:number=0;
    mz:number=0;
    h1x:number=0;
    score:number=0;
    flyz:number=0;
    end_game:number=0;
    flyobjfound:boolean=false;
    canvas: HTMLCanvasElement = document.querySelector("#app");
    public load(): void {
        this.game.loader.load({
            ["mrt.vert"]: { url: 'shaders/mrt.vert', type: 'text' }, // A vertex shader for multi-render-target rendering
            ["mrt.frag"]: { url: 'shaders/mrt.frag', type: 'text' }, // A fragment shader for multi-render-target rendering
            ["fullscreen.vert"]: { url: 'shaders/post-process/fullscreen.vert', type: 'text' }, // The vertex shader for all fullscreen effects
            ["motion-blur.frag"]: { url: 'shaders/post-process/motion-blur.frag', type: 'text' }, // The motion blur fragment shader
            ["blit.frag"]: { url: 'shaders/post-process/blit.frag', type: 'text' }, // A fragment shader that copies one texture to the screen
            ["house-model"]: { url: 'models/House/House.obj', type: 'text' },
            ["house-texture"]: { url: 'models/House/House.jpeg', type: 'image' },
            ["welldone_texture"]:{url: 'images/well_done.jpg', type: 'image'},
            ["oh_texture"]:{url: 'images/oh_no.jpg', type: 'image'},
            ["gun-model"]: { url: 'models/gun/Shotgun.obj', type: 'text' },
            ["gun-texture"]: { url: 'models/gun/Dkk.jpg', type: 'image' },            
            ["demo_model"]:{url:'models/Demonid/Demonid.obj',type:'text'},
             ["demo_text"]:{url:'models/House/House.jpeg',type:'image'},
            ["moon-texture"]: { url: 'images/moon.jpg', type: 'image' }
        });
    }

    public start(): void {
        // This shader program will draw 3D objects into multiple render targets
        this.programs["3d"] = new ShaderProgram(this.gl);
        this.programs["3d"].attach(this.game.loader.resources["mrt.vert"], this.gl.VERTEX_SHADER);
        this.programs["3d"].attach(this.game.loader.resources["mrt.frag"], this.gl.FRAGMENT_SHADER);
        this.programs["3d"].link();

        // This shader will do motion blur
        this.programs["motion-blur"] = new ShaderProgram(this.gl);
        this.programs["motion-blur"].attach(this.game.loader.resources["fullscreen.vert"], this.gl.VERTEX_SHADER);
        this.programs["motion-blur"].attach(this.game.loader.resources["motion-blur.frag"], this.gl.FRAGMENT_SHADER);
        this.programs["motion-blur"].link();

        // This shader will just copy a texture to the screen
        this.programs["blit"] = new ShaderProgram(this.gl);
        this.programs["blit"].attach(this.game.loader.resources["fullscreen.vert"], this.gl.VERTEX_SHADER);
        this.programs["blit"].attach(this.game.loader.resources["blit.frag"], this.gl.FRAGMENT_SHADER);
        this.programs["blit"].link();
        
        // We load the 3D models here
        this.meshes['moon'] = MeshUtils.Sphere(this.gl);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [20, 20] });
        this.meshes['well_done'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [20, 20] });
        this.meshes['oh_ya'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [20, 20] });
       
        this.meshes['player1'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [7, 7] });
        this.meshes['player2'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [7, 7] });
       
       
       
       
        this.meshes['house'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["house-model"]);
        this.meshes['gun'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["gun-model"]);
        this.meshes['demo'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["demo_model"]);
        
        // Load the moon texture ///------------>picture
        this.textures['moon'] = TextureUtils.LoadImage(this.gl, this.game.loader.resources['moon-texture']);
        this.textures['well_done'] =TextureUtils.LoadImage(this.gl, this.game.loader.resources['welldone_texture']) ;
            this.textures['oh_ya'] =TextureUtils.LoadImage(this.gl, this.game.loader.resources['oh_texture']) ;
        // Create a checkerboard texture for the ground----.pattern
        this.textures['ground'] = TextureUtils.CheckerBoard(this.gl, [1024, 1024], [256, 256], [26, 26, 26, 255], [255, 255, 255, 255]);
        
        this.textures['moon1'] = TextureUtils.CheckerBoard(this.gl, [1024, 1024], [256, 256], [6, 26, 26, 255], [2, 255, 25, 255]);
        this.textures['moon2'] = TextureUtils.CheckerBoard(this.gl, [1024, 1024], [256, 256], [6, 126, 26, 255], [2, 255, 155, 255]);
        
        // Load the house texture
        this.textures['house'] = TextureUtils.LoadImage(this.gl, this.game.loader.resources['house-texture']);
        this.textures['gun'] = TextureUtils.LoadImage(this.gl, this.game.loader.resources['gun-texture']);
        this.textures['demo'] = TextureUtils.LoadImage(this.gl, this.game.loader.resources['demo_text']);

        // Now we will create 3 texture to render our scene to.
        // The color target will hold the scene colors
        this.textures['color-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA8, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        // The motion target will hold the scene motion vectors
        this.gl.getExtension('EXT_color_buffer_float'); // Tell WebGL2 that we need to draw on Floating Point Textures
        this.textures['motion-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['motion-target']);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA32F, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        // The depth target will hold the scene depth
        this.textures['depth-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['depth-target']);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.DEPTH_COMPONENT32F, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        // Now we create a frame buffer and attach our 3 target textures to it.
        this.frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures['color-target'], 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT1, this.gl.TEXTURE_2D, this.textures['motion-target'], 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, this.textures['depth-target'], 0);

        // Check if the frame buffer is working
        let status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
        if (status != this.gl.FRAMEBUFFER_COMPLETE) {
            if (status == this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT)
                console.error("The framebuffer has a type mismatch");
            else if (status == this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT)
                console.error("The framebuffer is missing an attachment");
            else if (status == this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS)
                console.error("The framebuffer has dimension mismatch");
            else if (status == this.gl.FRAMEBUFFER_UNSUPPORTED)
                console.error("The framebuffer has an attachment with unsupported format");
            else if (status == this.gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE)
                console.error("The framebuffer has multisample mismatch");
            else
                console.error("The framebuffer has an unknown error");
        }

        // Create a regular sampler for textures rendered on the scene objects
        this.samplers['regular'] = this.gl.createSampler();
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        // Create a regular sampler for textures rendered fullscreen using post-processing
        this.samplers['postprocess'] = this.gl.createSampler();
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);

        // Create a camera and a controller for it
        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(5, 10, 30);
        this.camera.direction = vec3.fromValues(0, 0, -1);
        this.camera.aspectRatio = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.01;
        this.controller.fastMovementSensitivity = 0.1; // If you press Shift, the camera will move 10x faster

        // Enable backface culling
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);
        // Enable depth testing
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        // Now we create three 3D objects: a ground plane, a house and a moon
        
       
        this.objects['ground'] = {
            mesh: this.meshes['ground'],
            texture: this.textures['ground'],
            tint: [0, 1, 0, 1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 0, 0), vec3.fromValues(100, 1, 100)),
            previousModelMatrix: mat4.create()
        };
        this.objects['gun'] = {
            mesh: this.meshes['gun'],
            texture: this.textures['gun'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(-10, 0, -10), vec3.fromValues(0.001, 0.001, 0.001)),
            previousModelMatrix: mat4.create()
        };


  this.win = {
            mesh: this.meshes['ground'],
            texture: this.textures['well_done'],
            tint: [0.96, 0.91, 0.64, 1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 0, 0), vec3.fromValues(100, 1, 100)),
            previousModelMatrix: mat4.create()
        };

this.gameover = {
            mesh: this.meshes['ground'],
            texture: this.textures['oh_ya'],
            tint: [0.96, 0.91, 0.64, 1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(0, 0, 0), vec3.fromValues(100, 1, 100)),
            previousModelMatrix: mat4.create()
        };

      this.objects['house'] = {
            mesh: this.meshes['house'],
            texture: this.textures['house'],
            tint: [1,1,1,1],
            currentModelMatrix:mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(10, 0, 10), vec3.fromValues(0.001, 0.001, 0.001)),
            previousModelMatrix: mat4.create()
        };
 
        this.objects['demo'] = {
            mesh: this.meshes['demo'],
            texture: this.textures['demo'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, 0, 22.5), vec3.fromValues(100, -100,100), vec3.fromValues(13, 13, 13)),
            previousModelMatrix: mat4.create()
             
        };
        this.objects['moon'] = {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, 0, 22.5), vec3.fromValues(100, -100,100), vec3.fromValues(3, 3, 3)),
            previousModelMatrix: mat4.create()
        };
        
        this.objects['bul1']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-58, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul2']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-56, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul3']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-54, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul4']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-52, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul5']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-50, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul6']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-48, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul7']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-46, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul8']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-44, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul9']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-42, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul10']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-40, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul11']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-38, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul12']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-36, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul13']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-34, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul14']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-32, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul15']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-30, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul16']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-28, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul17']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-26, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul18']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-24, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bullet_toget'] = {
            mesh: this.meshes['house'],
            texture: this.textures['well_done'],
            tint: [1,1,1,1],
            currentModelMatrix:mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(30, 3, -10), vec3.fromValues(1, 1, 1)),
            previousModelMatrix: mat4.create()
        };
        
        this.objects['bullet_toget2'] = {
            mesh: this.meshes['house'],
            texture: this.textures['oh_ya'],
            tint: [1,1,1,1],
            currentModelMatrix:mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(-30, 3, -10), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bullet_toget3'] = {
            mesh: this.meshes['house'],
            texture: this.textures['oh_ya'],
            tint: [1,1,1,1],
            currentModelMatrix:mat4.fromRotationTranslationScale(mat4.create(),quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues(-30, 3, -10), vec3.fromValues(0.8, 0.8, 0.8)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bullet_toget4'] = {
            mesh: this.meshes['house'],
            texture: this.textures['oh_ya'],
            tint: [1,1,1,1],
            currentModelMatrix:mat4.fromRotationTranslationScale(mat4.create(),quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues(-30, 3, -10), vec3.fromValues(0.8, 0.8, 0.8)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bullet_toget5'] = {
            mesh: this.meshes['moon'],
            texture: this.textures['well_done'],
            tint: [1,1,1,1],
            currentModelMatrix:mat4.fromRotationTranslationScale(mat4.create(),quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues(0, 3, -30), vec3.fromValues(9, 9, 9)),
            previousModelMatrix: mat4.create()
        };
   
        this.objects['bul19']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-22, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.objects['bul20']= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-20, 47,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
       
        this.score1= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon1'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-50, 40,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };  
        this.score2= {
            mesh: this.meshes['moon'],
            texture: this.textures['moon1'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(-52, 40,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };  
 


        this.score3 = {
            mesh: this.meshes['moon'],//////
            texture: this.textures['moon1'],//////
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(), vec3.fromValues(-54, 40,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };

        this.score4 = {
            mesh: this.meshes['moon'],
            texture: this.textures['moon1'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-56, 40,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };
        this.score5 = {
            mesh: this.meshes['moon'],
            texture: this.textures['moon1'],
            tint: [1,1,1,1],
            currentModelMatrix: mat4.fromRotationTranslationScale(mat4.create(), quat.create(),vec3.fromValues(-58, 40,-9), vec3.fromValues(0.9, 0.9, 0.9)),
            previousModelMatrix: mat4.create()
        };

     
        if (this.end_game==0){
        document.addEventListener("keydown", (ev)=>{
        
            let key = ev.key;
           
            switch(ev.key){
  ///              case Key.ArrowUp:
//break;

                //case Key.ArrowDown:this.my-=7;break;        
           case Key.ArrowUp:
                           
                         {  
                             if (this.checkmoon==1){
                               this.x_at_shoot= this.mx;
                               this.num_of_bullet--;
                            this.flyobj();
                            }
                          break;
                         }

                case Key.ArrowLeft:
                    {
                        this.mx=this.mx-1;
                        if(this.mx<=-6)
                        {this.mx=-6;
                        
                        }
                        break;
                    }
                
                case Key.ArrowRight:
                    {
                        this.mx=this.mx+1;
                        if(this.mx>=20)
                        {this.mx=20;}
                        break; 
                    }
                    case ' ':break;
            }


        }
    );


        this.setupControls();
    }}
      flyobj()
    {      
        if(this.num_of_bullet>=1)//when game over
    {
        this.flyobjfound=true; ////flag if the the arrow up pressed        
        this.counter=0;     
         this.checkmoon=0;
        }
    }
    public draw(deltaTime: number): void {
        // Before updating the camera controller, We stor the old VP matrix to be used in motion blur
       
         
        this.VP_prev = this.camera.ViewProjectionMatrix;
        this.controller.update(deltaTime); // then we update the camera controller

        if(!this.paused){ // If paused, we will skip updating time and the matrices
            this.time += deltaTime; // Update time
            for(let key in this.objects){ // Before calculating new model matrices, we store the previous model matrices
                let obj = this.objects[key];
                obj.previousModelMatrix = obj.currentModelMatrix;
            }

            if (this.num_of_bullet==0)
            {
                this.objects["game_over"]=this.gameover;
            }
            else if(this.num_of_bullet==20)
            {
              this.objects['bul1'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            }
             else if(this.num_of_bullet==19)
            {
              this.objects['bul2'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==18)
            {
              this.objects['bul3'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==17)
            {
              this.objects['bul4'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==16)
            {
              this.objects['bul5'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==15)
            {
              this.objects['bul6'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==14)
            {
              this.objects['bul7'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==13)
            {
              this.objects['bul8'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==12)
            {
              this.objects['bul9'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==11)
            {
              this.objects['bul10'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==10)
            {
              this.objects['bul11'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==9)
            {
              this.objects['bul12'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==8)
            {
              this.objects['bul13'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==7)
            {
              this.objects['bul14'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==6)
            {
              this.objects['bul15'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==5)
            {
              this.objects['bul16'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==4)
            {
              this.objects['bul17'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==3)
            {
              this.objects['bul18'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            } else if(this.num_of_bullet==2)
            {
              this.objects['bul19'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            }
            else if(this.num_of_bullet==1)
            {
              this.objects['bul20'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0, 0, 0));
            }



            // Now we update the matrices
            this.h1x=-20 - 20 + 100*triangle(this.time/10000);////motin in the direction of x-axis

        this.objects['gun'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues( this.mx,3,25), vec3.fromValues(0.7, 0.7, 0.7));
            if (this.end_game==0)
        {this.objects['house'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, 0, 0), vec3.fromValues( this.h1x,3,0), vec3.fromValues(0.7, 0.7, 0.7));
        this.objects['bullet_toget3']. currentModelMatrix=mat4.fromRotationTranslationScale(mat4.create(),quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues(-40, 3, this.h1x), vec3.fromValues(0.8, 0.8, 0.8));
        this.objects['bullet_toget4']. currentModelMatrix=mat4.fromRotationTranslationScale(mat4.create(),quat.fromEuler(quat.create(), 0, -90, 0), vec3.fromValues(40, 3, this.h1x-2), vec3.fromValues(0.8, 0.8, 0.8));
          this.objects['bullet_toget5']. currentModelMatrix=mat4.fromRotationTranslationScale(mat4.create(),quat.fromEuler(quat.create(), 0, this.h1x*5, 0), vec3.fromValues(0, 3, -40), vec3.fromValues(9, 9, 9)) 
        /////motoin in the direction of z
            if(this.flyobjfound==true){
                this.flyz=(15-Math.floor(this.counter*this.bullet_speed));
            this.objects['moon'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(),quat.create(), vec3.fromValues(  this.x_at_shoot,3,this.flyz), vec3.fromValues(0.7, 0.7, 0.7));
            if(this.flyz<=0)////pass  the house
            {  

               if(this.flyz==0 && this.h1x+4>=this.x_at_shoot&&this.h1x-4<=this.x_at_shoot)
                {
                    
                    this.score++;
                    if(this.score==1)
                    {
                        this.objects["sc1"]=this.score1;
                    }
                    if(this.score==2)
                    {
                        this.objects["sc2"]=this.score2;
                    }
                    if(this.score==3)
                    {
                        this.objects["sc3"]=this.score3;
                    }
                     if(this.score==4)
                    {
                        this.objects["sc4"]=this.score4;
                    }
                    if(this.score==5)
                    {
                        this.objects["sc5"]=this.score5;
                         this.objects["winer"]=this.win;
                        this.end_game=1;
                    }

                }

             
     this.objects['moon'].currentModelMatrix = mat4.fromRotationTranslationScale(mat4.create(), quat.fromEuler(quat.create(), 0, 360*this.time/1000, 0), vec3.fromValues(this.mx, this.my, -20), vec3.fromValues(0, 0, 0))
            
          this.flyobjfound=false;
          this.checkmoon=1;
            }
            else
            {
                this.counter=this.counter+1;
            
        
    }
        }
            
        }








        // To start drawing the scene, we bind our frame buffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        {
            this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight); // Ensure that the viewport covers the whole framebuffer
            this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0, this.gl.COLOR_ATTACHMENT1]); // Then we tell WebGL that both of those attachments will have an output from the fragment shader
            this.gl.clearBufferfv(this.gl.COLOR, 0, [0.88, 0.65, 0.15, 1]); // Clear the color target
            this.gl.clearBufferfv(this.gl.COLOR, 1, [0, 0, 0, 1]); // Clear the motion target
            this.gl.clearBufferfi(this.gl.DEPTH_STENCIL, 0, 1, 0); // Clear the depth target

            let program = this.programs['3d']; // Now, we use the MRT shader to render the scene into multiple render targets
            program.use();
/////////////////////

this.programs['3d'].setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
this.programs['3d'].setUniform3f("cam_position", this.camera.position);

this.programs['3d'].setUniform3f("light.diffuse", this.light.diffuse);
this.programs['3d'].setUniform3f("light.specular", this.light.specular);
this.programs['3d'].setUniform3f("light.ambient", this.light.ambient);
this.programs['3d'].setUniform3f("light.position", this.light.position);
this.programs['3d'].setUniform1f("light.attenuation_quadratic", this.light.attenuation_quadratic);
this.programs['3d'].setUniform1f("light.attenuation_linear", this.light.attenuation_linear);
this.programs['3d'].setUniform1f("light.attenuation_constant", this.light.attenuation_constant);

this.programs['3d'].setUniform3f("material.diffuse", [0.5,55,0.5]);
this.programs['3d'].setUniform3f("material.specular", [0.2,0.2,0.2]);
this.programs['3d'].setUniform3f("material.ambient", [0.1,13,0.1]);
this.programs['3d'].setUniform1f("material.shininess", 2);


/////////////////////////
            //program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix); // Send the View Projection matrix
           
            program.setUniformMatrix4fv("VP_Prev", false, this.VP_prev); // Send the View Projection matrix
           
           
           
            //program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix); // Send the View Projection matrix
            //program.setUniformMatrix4fv('P_i', false, mat4.invert(mat4.create(), this.camera.ViewProjectionMatrix));               
            
            // For each object, setup the shader uniforms then draw
            for(let key in this.objects){
                let obj = this.objects[key];
                //TODO: Add any uniforms you need here
 /////////////////////


 //program.setUniformMatrix4fv("M_it", false, mat4.invert(mat4.create(), obj.currentModelMatrix));
 program.setUniform3f("material.diffuse", this.material.diffuse);
 program.setUniform3f("material.specular", this.material.specular);
 program.setUniform3f("material.ambient", this.material.ambient);
 program.setUniform1f("material.shininess", this.material.shininess);

 ///////////////////
                program.setUniformMatrix4fv("MPrev", false, obj.previousModelMatrix); // Send the model matrix of the object in the current frame
                program.setUniformMatrix4fv("M", false, obj.currentModelMatrix); // Send the model matrix of the object in the current frame
                program.setUniform4f("tint", obj.tint); // Send the color tint
                this.gl.activeTexture(this.gl.TEXTURE0); // Bind the texture and sampler to unit 0
                this.gl.bindTexture(this.gl.TEXTURE_2D, obj.texture);
                program.setUniform1i('texture_sampler', 0);
                this.gl.bindSampler(0, this.samplers['regular']);
                obj.mesh.draw(this.gl.TRIANGLES); // Draw the object mesh
            }
        }

        // Now we go back to the default framebuffer (the canvas frame buffer)
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        {
            this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight); // Ensure that the viewport covers the whole canvas
            this.gl.clearColor(0, 0, 0, 1); // Set a black clear color (not important since it will be overwritten)
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT); // Clear the color and depth of the canvas

            if(this.motionBlurEnabled){ // If motion blur is enabled, draw fullscreen using the motion blur shader
                let program = this.programs['motion-blur'];
                program.use();
                //TODO: Add any uniforms you need
                program.setUniformMatrix4fv("VP_Prev", false, this.VP_prev); // Send the View Projection matrix
                //program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix); // Send the View Projection matrix
                program.setUniformMatrix4fv('P_i', false, mat4.invert(mat4.create(), this.camera.ViewProjectionMatrix));
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']);
                program.setUniform1i('color_sampler', 0);
                //program.setUniform1f('sigma', 2);
                this.gl.bindSampler(0, this.samplers['postprocess']);
                
                this.gl.activeTexture(this.gl.TEXTURE1);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['depth-target']);
                program.setUniform1i('depth_sampler', 1);
                
                this.gl.activeTexture(this.gl.TEXTURE2);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['motion-target']);
                program.setUniform1i('motionVec', 2);
                ///////////////////////////////
                
                this.gl.bindSampler(1, this.samplers['postprocess']);
                this.gl.bindSampler(2, this.samplers['postprocess']);
                this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
///////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
            } else { // If motion blur is disabled, we just blit the color target to full screen
                let program = this.programs['blit'];
                program.use();
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']);
                program.setUniform1i('color_sampler', 0);
                this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
            }
        }
    }
    }
    public end(): void {
        // Clean memory
        for (let key in this.programs)
            this.programs[key].dispose();
        this.programs = {};
        for (let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        this.gl.deleteFramebuffer(this.frameBuffer);
        for (let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
        this.clearControls();
    }


    /////////////////////////////////////////////////////////
    ////// ADD CONTROL TO THE WEBPAGE (NOT IMPORTNANT) //////
    /////////////////////////////////////////////////////////
    private setupControls() {
        const controls = document.querySelector('#controls');

        controls.appendChild(
            <div>
                <div className="control-row">
                    <CheckBox value={this.motionBlurEnabled} onchange={(v)=>{this.motionBlurEnabled = v;}}/>
                    <label className="control-label">Enable Motion Blur</label>
                </div>
                <div className="control-row">
                    <CheckBox value={this.paused} onchange={(v)=>{this.paused = v;}}/>
                    <label className="control-label">Pause</label>
                </div>
            </div>

        );

    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}