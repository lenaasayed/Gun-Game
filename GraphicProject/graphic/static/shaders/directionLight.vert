#version 300 es
layout(location=0) in vec3 position;
layout(location=3) in vec3 normal;

out vec3 v_normal;
out vec3 v_view;

uniform mat4 MGround;
uniform mat4 MGround_it;
uniform mat4 VP_light;
uniform vec3 cam_position;

void main(){
    vec4 world = MGround * vec4(position, 1.0f);
    gl_Position = VP_light* world; 
    v_normal = (MGround_it * vec4(normal, 0.0f)).xyz;
    v_view = cam_position - world.xyz;
}