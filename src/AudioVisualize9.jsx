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

function AudioSphere9() {
    const canvasRef = useRef(null);
    const audioContext = new window.AudioContext();//|| window.webkitAudioContext)();  // Create audio context
    const musicPaths = ["1.mp3", "3.mp3"];//, "5.mp3", "8.mp3", "9.mp3"];
    const spheres = useRef([]);
    const icospheres = useRef([]);
    let currentTime = 0.0;
    const timeIncrement = 0.01;
    const isCancelledRef = useRef(false);

    async function setupAudio(audioContext, musicPath) {
        const response = await fetch(musicPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const bpm = await guess(audioBuffer);

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const gainNode = audioContext.createGain();

        source.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);

        return { source, analyser, bpm, gainNode };
    }

    useEffect(() => {
        isCancelledRef.current = false;
        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);

        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 20, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);
        const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);

        scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: 'immersive-ar',
            },
        });/*.then((experience) => {
            camera = experience.baseExperience.camera;  // XRカメラを使用
            //sphere.position = camera.getFrontPosition(2);  // カメラの前方2mに配置
        });*/

        const setupIcoSpheres = async () => {
            const icospherePromises = musicPaths.map(async (path, index) => {
                const icosphere = MeshBuilder.CreateIcoSphere(`sphere${index}`, { radius: 4, subdivisions: 5 }, scene);
                icosphere.musicPath = path;
                icosphere.position = new Vector3(index * 12, 0, 60); //z軸
                const shaderMaterial = new ShaderMaterial(
                    'sampleShader' + index,
                    scene,
                    {
                        vertexSource: vertShader,
                        fragmentSource: fragShader,
                    },
                    {
                        attributes: ['position', 'normal'],
                        uniforms: ['worldViewProjection'],
                    }
                );
                shaderMaterial.backFaceCulling = false;
                shaderMaterial.fillMode = Material.WireFrameFillMode;
                icosphere.material = shaderMaterial;
                shaderMaterial.setFloat('u_time', 0.0);
                shaderMaterial.setFloat('u_low_frequency', 0.0);
                shaderMaterial.setFloat('u_high_frequency', 0.0);
                shaderMaterial.setFloat('u_all_frequency', 0.0);
                shaderMaterial.setFloat('u_red', 0.0);
                shaderMaterial.setFloat('u_green', 0.0);
                shaderMaterial.setFloat('u_blue', 0.0);

                //audioの設定
                const audioProps = await setupAudio(audioContext, icosphere.musicPath);

                if (isCancelledRef.current) return null;

                icosphere.audio = audioProps.source;
                icosphere.analyser = audioProps.analyser;
                icosphere.bpm = audioProps.bpm.bpm;
                icosphere.gain = audioProps.gainNode;

                icosphere.gain.gain.value = 0.0;

                const childSphere = MeshBuilder.CreateSphere(`childSphere${index}`, { diameter: 2 }, scene);
                childSphere.parent = icosphere;
                childSphere.position = new Vector3(0, 0, 0);
                childSphere.material = new StandardMaterial("childMaterial" + index, scene);
                childSphere.bpm = audioProps.bpm.bpm;
                childSphere.index = index;
                childSphere.actionManager = new ActionManager(scene);
                childSphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, async () => {
                    if (icosphere.isPlaying) {
                        //console.log(`Sphere[${childSphere.index}]のbpm: `, childSphere.bpm);
                    }
                }));

                //sphereのアニメーション。関数にして外に出したい
                const frameRate = 60;
                const animationTime = 60 / childSphere.bpm; // Duration of one beat
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
                icosphere.actionManager = new ActionManager(scene);
                icosphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, async () => {
                    if (!isPlaying) {
                        icosphere.audio.start();
                        //animations.forEach(anim => scene.beginDirectAnimation(sphere, [anim], 0, totalFrames, true));
                        //ここのanimation,1テンポ遅れるときがある（最初のマウント時）
                        icosphere.isPlaying = true;
                        console.log(icosphere.bpm);
                        console.log(`Sphere[${childSphere.index}]のbpm: `, childSphere.bpm);
                        console.log(index);
                        animations.forEach(anim => scene.beginDirectAnimation(childSphere, [anim], 0, totalFrames, true));
                    } else {
                        icosphere.audio.stop();
                        icosphere.isPlaying = false;
                    }
                }));//ここのsphere再生ロジックは保留(クリックの度にaudioPropsが生成されるため、sphere.audio.stopにアクセスできない)
                icospheres.current.push(icosphere);
                return icosphere;
            });

            return await Promise.all(icospherePromises);
        };

        setupIcoSpheres();

        const transformBalls = (icospheres) => {
            icospheres.forEach((icosphere, i) => {
                icosphere.position.z -= 0.05;
                if (icosphere.position.z < 0) {
                    icosphere.position.z = 60;
                }
                icosphere.gain.gain.value += 0.001;
            });
        };
        const transformBall = (icosphere) => {
            icosphere.position.z += 0.05;
            if (icosphere.position.z > 100) {
                icosphere.position.z = 0;
            }
        };

        engine.runRenderLoop(() => {
            currentTime += timeIncrement;
            transformBalls(icospheres.current);
            icospheres.current.forEach((icosphere, i) => {
                if (icosphere.analyser && icosphere.isPlaying) {
                    const bufferLength = icosphere.analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    icosphere.analyser.getByteFrequencyData(dataArray);
                    const freqAverage = dataArray.reduce((acc, cur) => acc + cur) / bufferLength;
                    let colorIntensity = freqAverage / 255 * 5;
                    let redIntensity = Math.sin(colorIntensity * Math.PI);
                    let greenIntensity = Math.cos(colorIntensity * Math.PI);
                    let blueIntensity = 1 - colorIntensity;
                    icosphere.material.diffuseColor = new Color3(redIntensity, greenIntensity, blueIntensity);

                    icosphere.index = i;
                    //transformBall(icosphere);//icosphereの移動

                    //元のコードでの波長処理（視覚化のところなので、あとで調整する）
                    let allFreqAverage = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
                    let lowFreqAverage = dataArray.slice(0, bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                    let highFreqAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                    icosphere.allFreqAverage = allFreqAverage;
                    icosphere.lowFreqAverage = lowFreqAverage;
                    icosphere.highFreqAverage = highFreqAverage;
                    icosphere.material.setFloat("u_low_frequency", icosphere.lowFreqAverage);
                    icosphere.material.setFloat("u_high_frequency", icosphere.highFreqAverage);
                    icosphere.material.setFloat("u_all_frequency", icosphere.allFreqAverage);
                    icosphere.material.setFloat("u_red", icosphere.lowFreqAverage / 255 * 2);
                    icosphere.material.setFloat("u_green", icosphere.lowFreqAverage / 255);
                    icosphere.material.setFloat("u_blue", icosphere.lowFreqAverage / 255);
                    icosphere.material.setFloat("u_time", currentTime);
                    //console.log(`Sphere[${icosphere.index}]のlowFreqAverage: `, icosphere.lowFreqAverage);
                    //console.log(`Sphere[${icosphere.index}]のhighFreqAverage: `, icosphere.highFreqAverage);
                    //console.log(`Sphere[${icosphere.index}]のallFreqAverage: `, icosphere.allFreqAverage);
                    //console.log(`Sphere[${icosphere.index}]のu_red:`, icosphere.lowFreqAverage / 255 * 2);
                    //console.log(`Sphere[${icosphere.index}]のu_green:`, icosphere.lowFreqAverage / 255);
                    //console.log(`Sphere[${icosphere.index}]のu_blue:`, icosphere.lowFreqAverage / 255);

                    // icosphere.gain.gain.value += 0.001;
                }
            });

            scene.render();
        });

        return () => {
            isCancelledRef.current = true;
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

export default AudioSphere9;
