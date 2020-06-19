#version 300 es
precision highp float;

//TODO: Modify as needed
in vec2 v_screencoord;
in vec4 v_color;
out vec4 color;
uniform sampler2D depth_sampler;
uniform sampler2D color_sampler;
uniform sampler2D motionVec;
//uniform float sigma;
uniform mat4 P_i;   // inverse viewProjection matrix inverse
uniform mat4 VP_Prev;
////in3rd line we convert vscreen"2d"[0:1] to vec4"indeces"[-1,1] so we 2*vsreen-1 to be 1
///in final we need to change from indeces vec4 to screen vec2 so we conver by using linear algebra^^ 
/// we need to divide by w az i donot want to change  "currentWorldPosition" as projection matrix it is the main factor to change w"يأثر"
//// vscreen coord is the NDC_CURR ^^
////vec ->0

void main(){
//////////////////////////
    float depth = texture(depth_sampler, v_screencoord).x; // read the depth from the depth texture
    vec4 motionVecfl = texture(motionVec, v_screencoord); // read the depth from the depth texture;xyzw==x as texture->get vec4
    vec4 NDC_curr=vec4(2.0*v_screencoord.x-1.0, 2.0*v_screencoord.y-1.0, 2.0*depth-1.0, 1.0);////we see w=1
    vec4 currentWorldPosition = P_i * vec4(2.0*v_screencoord.x-1.0, 2.0*v_screencoord.y-1.0, 2.0*depth-1.0, 1.0); // regenerate the NDC and multiply by projection inverse
    currentWorldPosition=currentWorldPosition/currentWorldPosition.w;
    vec4 PrevWorldPosition= currentWorldPosition-motionVecfl;
    vec4 NDC_Prev=VP_Prev*PrevWorldPosition;
    NDC_Prev=NDC_Prev/NDC_Prev.w;  
    vec2 prev_screen=vec2((NDC_Prev.x+1.0)/2.0,(NDC_Prev.y+1.0)/2.0);
/////////////////////////////////////////////////////////

color = vec4(0.0); // Sample texture color and send it as is
/////////////////////////
for(int i=0;i<10;i++)
{
vec2 position =mix(v_screencoord,prev_screen,float(i)/10.0);
vec4 currcolor=texture(color_sampler, position);
color+=currcolor;
}
color=color/10.0;    




/////////////////////////////////////////////////////////////////////
//color1 =mix(v_screencoord,prev_screen,i);
//color = abs(motionVecfl);
//color.a = 1.0;
}

//type script in 5 minutes
//sketchfab
//programe blender//download/import/gltf/folder/unselected->object/export