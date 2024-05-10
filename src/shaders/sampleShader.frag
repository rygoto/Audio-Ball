precision highp float;
//uniform float time;
uniform float u_low_frequency;
uniform float u_high_frequency;
uniform float u_red;
uniform float u_blue;
uniform float u_green;

/*
void main() {
    gl_FragColor = vec4(vec3(u_red, u_green, u_blue), 1. );
}*/

void main() {
    // 低周波数の平均値で赤、緑の成分を設定
    float blue = u_low_frequency / 255.0;
    float green = (u_low_frequency + u_high_frequency) / 510.0;
    
    // 高周波数の平均値で青の成分を設定
    float red = u_high_frequency / 255.0 * 50.0;

    // カラフルな色を生成
    gl_FragColor = vec4(vec3(red, green, blue), 1.0);
}