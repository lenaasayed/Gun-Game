#version 300 es
precision highp float;

in vec3 v_world;
in vec3 v_normal;
in vec3 v_view;

///////////////////////////////////////
//out vec4 color;

struct Material {
    vec3 diffuse;
    vec3 specular;
    vec3 ambient;
    float shininess;
};
uniform Material material;

struct PointLight {
    vec3 diffuse;
    vec3 specular;
    vec3 ambient;
    vec3 position;
    float attenuation_quadratic;
    float attenuation_linear;
    float attenuation_constant;
};
uniform PointLight light;

float diffuse(vec3 n, vec3 l){
    //Diffuse (Lambert) term computation: reflected light = cosine the light incidence angle on the surface
    //max(0, ..) is used since light shouldn't be negative
    return max(0.0f, dot(n,l));
}

float specular(vec3 n, vec3 l, vec3 v, float shininess){
    //Phong Specular term computation
    return pow(max(0.0f, dot(v,reflect(-l, n))), shininess);
}


//////////////////////////////////
//TODO: Modify as needed

in vec4 v_color;
in vec2 v_texcoord;
in vec4 motionVec;

layout(location=0) out vec4 color;
layout(location=1) out vec4 motion; // Send the motion vectors here

uniform vec4 tint;
uniform sampler2D texture_sampler;
mat4 mm=mat4(vec4(1,0,0,0),vec4(0,1,0,0),vec4(0,0,1.5,0),vec4(0,0,0,1.5));
void main(){
    color = texture(texture_sampler, v_texcoord) * v_color * tint; // Send our interpolated color
   
 vec3 n = normalize(v_normal);
    vec3 v = normalize(v_view);
    vec3 l = light.position - v_world;
    float d = length(l);
    l /= d;

   mm [0][0]=color[0];
   mm [1][1]=color[1];
   mm [2][2]=color[2];
   mm [3][3]=color[3];
vec3 mve=vec3(color[0],color[1],color[2]);
    float attenuation = light.attenuation_constant +
                        light.attenuation_linear * d +
                        light.attenuation_quadratic * d * d;
    color += vec4(
        material.ambient*light.ambient + 
        (
            material.diffuse*light.diffuse*diffuse(n, l) + 
            material.specular*light.specular*specular(n, l, v, material.shininess)
        )/attenuation,
        1.0f
    );
    //Notice that Attenuation only affects diffuse and specular term  
    
    color = texture(texture_sampler, v_texcoord) * v_color * tint; // Send our interpolated color
    motion = motionVec;
}