#version 300 es
/////////////////////
//TODO: Modify as needed

layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 texcoord;
layout(location=3) in vec3 normal;

///******//
out vec3 v_world;
out vec3 v_normal;
out vec3 v_view;


//uniform mat4 Mpgr;
//uniform mat4 M_it;
//uniform mat4 VP_ground;
uniform vec3 cam_position;


/////****////
out vec4 v_color;
out vec2 v_texcoord;
out vec4 motionVec;

out vec2 v_screencoord; 
uniform mat4 M;
uniform mat4 VP;
uniform mat4 MPrev;
void main(){

    vec4 world = M * vec4(position, 1.0f);
    gl_Position = VP * world; 
    vec4 prevWorld=MPrev* vec4(position, 1.0f);
    motionVec=world-prevWorld;




    v_color = color;
    v_texcoord = texcoord;
     v_world = world.xyz;
    v_normal =vec4(normal,1.0f).xyz;
    // (M_it * vec4(normal, 1.0f)).xyz;
    v_view = cam_position - world.xyz;
}