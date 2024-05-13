import React, { useEffect, useRef, useState } from 'react';
import {
    Engine,
    Scene,
    Vector3,
    ArcRotateCamera,
    HemisphericLight,
    MeshBuilder,
    StandardMaterial,
    ShaderMaterial,
    Color3,
    Animation,
    Material,
    ActionManager,
    ExecuteCodeAction
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { guess } from 'web-audio-beat-detector';
import vertShader from './shaders/sampleShader.vert?raw';
import fragShader from './shaders/sampleShader.frag?raw';

function AudioSphere4() {
    const canvasRef = useRef(null);
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();  // Create audio context
    const musicPaths = ["1.mp3", "2.mp3", "3.mp3"];
    const spheres = useRef([]);

    async function setupAudio(audioContext, musicPath) {
        const response = await fetch(musicPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const bpm = await guess(audioBuffer);

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        //source.start();
        return { source, analyser, bpm };
    }

    useEffect(() => {
        let isCancelled = false;
        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);

        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 20, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);
        const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);

        //const spheres = [];
        musicPaths.forEach(async (path, index) => {
            if (!isCancelled) {
                const sphere = MeshBuilder.CreateSphere(`sphere${index}`, { diameter: 2 }, scene);
                sphere.musicPath = path;
                sphere.position = new Vector3(index * 6, 0, 0);
                const material = new StandardMaterial("material" + index, scene);
                sphere.material = material;
                console.log(sphere.musicPath);

                const audioProps = await setupAudio(audioContext, sphere.musicPath);
                sphere.audio = audioProps.source;
                sphere.analyser = audioProps.analyser;
                sphere.bpm = audioProps.bpm.bpm;

                //sphereのアニメーション。関数にして外に出したい
                const frameRate = 60;
                const animationTime = 60 / sphere.bpm; // Duration of one beat
                const totalFrames = frameRate * animationTime;

                const animations = ['x', 'y', 'z'].map(axis => {
                    const animation = new Animation(
                        "scaleAnimation" + axis,
                        "scaling." + axis,
                        frameRate,
                        Animation.ANIMATIONTYPE_FLOAT,
                        Animation.ANIMATIONLOOPMODE_CYCLE
                    );
                    const keyFrames = [
                        { frame: 0, value: 0.7 },
                        { frame: totalFrames * 0.1 / 2, value: 1.5 },
                        { frame: totalFrames, value: 0.7 }
                    ];
                    animation.setKeys(keyFrames);
                    return animation;
                });
                //ここまで

                let isPlaying = false;
                sphere.actionManager = new ActionManager(scene);
                sphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, async () => {
                    if (!isPlaying) {
                        sphere.audio.start();
                        animations.forEach(anim => scene.beginDirectAnimation(sphere, [anim], 0, totalFrames, true));
                        //ここのanimation,1テンポ遅れるときがある（最初のマウント時）
                        sphere.isPlaying = true;
                        console.log(sphere.bpm);
                    } else {
                        sphere.audio.stop();
                        sphere.isPlaying = false;
                    }
                }));//ここのsphere再生ロジックは保留(クリックの度にaudioPropsが生成されるため、sphere.audio.stopにアクセスできない)
                spheres.current.push(sphere);
            }
        });

        engine.runRenderLoop(() => {
            spheres.current.forEach((sphere, i) => {
                if (sphere.analyser && sphere.isPlaying) {
                    const bufferLength = sphere.analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    sphere.analyser.getByteFrequencyData(dataArray);
                    const freqAverage = dataArray.reduce((acc, cur) => acc + cur) / bufferLength;
                    let colorIntensity = freqAverage / 255 * 5;
                    let redIntensity = Math.sin(colorIntensity * Math.PI);
                    let greenIntensity = Math.cos(colorIntensity * Math.PI);
                    let blueIntensity = 1 - colorIntensity;
                    sphere.material.diffuseColor = new Color3(redIntensity, greenIntensity, blueIntensity);

                    //元のコードでの波長処理（視覚化のところなので、あとで調整する）
                    let allFreqAverage = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
                    let lowFreqAverage = dataArray.slice(0, bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                    let highFreqAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                    //let changLowFreq = Math.abs(lowFreqAverage - previouseLowFreqAverage);
                    //let lowFreqAverageEmphasis = changLowFreq * 10.0 * 2.0;
                    //previouseLowFreqAverage = lowFreqAverage;
                    console.log("lowFreqAverage: ", lowFreqAverage);
                    console.log("highFreqAverage: ", highFreqAverage);
                    console.log("allFreqAverage: ", allFreqAverage);
                    //shaderMaterial.setFloat("u_low_frequency", lowFreqAverageEmphasis);
                    //shaderMaterial.setFloat("u_high_frequency", highFreqAverage);
                    //shaderMaterial.setFloat("u_all_frequency", allFreqAverage);
                    //shaderMaterial.setFloat("u_red", lowFreqAverage / 255);
                    //shaderMaterial.setFloat("u_green", lowFreqAverage / 255);
                    //shaderMaterial.setFloat("u_blue", lowFreqAverage / 255);
                    //console.log(`Sphere ${i + 1} freqAverage: `, freqAverage);
                } else {
                    //console.log("No data");
                }
            });
            scene.render();
        });

        return () => {
            isCancelled = true;
            engine.stopRenderLoop();
            engine.dispose();
        }
    }, []);

    return (
        <>
            <canvas ref={canvasRef} style={{ width: '800px', height: '600px' }} />
        </>
    );

}

export default AudioSphere4;
