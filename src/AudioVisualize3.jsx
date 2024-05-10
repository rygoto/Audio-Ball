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
    Effect,
    Material,
    DefaultRenderingPipeline,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { guess } from 'web-audio-beat-detector';
//import { vertexshader, fragmentshader } from './glsl/shader';
import vertShader from './shaders/sampleShader.vert?raw';
import fragShader from './shaders/sampleShader.frag?raw';

function AudioSphere3() {
    const canvasRef = useRef(null);
    const [audioContext, setAudioContext] = useState(null);
    const [analyser, setAnalyser] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [bpm, setBpm] = useState(60);
    const sphereRef = useRef(null); // Reference to the sphere object
    let currentTime = 0.0;
    const timeIncrement = 0.01;

    useEffect(() => {
        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);

        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);

        const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);
        const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 2 }, scene);
        const material = new StandardMaterial("material", scene);
        sphere.material = material;
        sphereRef.current = sphere;
        //sphere.material.alpha = 0.0;

        //Create LawFrequency Icosphere and ShaderMaterial
        const icosphere = MeshBuilder.CreateIcoSphere("icoSphere", { radius: 4, subdivisions: 3 }, scene);
        const shaderMaterial = new ShaderMaterial(
            'sampleShader',
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
        shaderMaterial.backFaceCulling = false; // If you want to show backfaces in wireframe
        shaderMaterial.fillMode = Material.WireFrameFillMode;
        icosphere.material = shaderMaterial;
        //End Create LawFrequency Icosphere and ShaderMaterial

        //Create PostProcess
        /*const pipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);
        pipeline.bloomEnabled = true; // 有効にする
        pipeline.bloomThreshold = 6; // 明るさの閾値を調整
        pipeline.bloomWeight = 3.0; // エフェクトの強度
        pipeline.bloomKernel = 300; // エフェクトの半径
        pipeline.bloomScale = 20; // ブルームのサイズを調整*/
        //End Create PostProcess

        scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: 'immersive-ar',
            },
        });

        //Create Render excute function
        const runRenderLoop = () => {
            currentTime += timeIncrement;
            shaderMaterial.setFloat("u_time", currentTime);  // Update shader time   

            if (analyser) {
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);

                let lowFreqAverage = dataArray.slice(0, bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                let highFreqAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                console.log("lowFreqAverage: ", lowFreqAverage);
                console.log("highFreqAverage: ", highFreqAverage);
                shaderMaterial.setFloat("u_low_frequency", lowFreqAverage);
                shaderMaterial.setFloat("u_high_frequency", highFreqAverage);
                shaderMaterial.setFloat("u_red", lowFreqAverage / 255);
                shaderMaterial.setFloat("u_green", lowFreqAverage / 255);
                shaderMaterial.setFloat("u_blue", lowFreqAverage / 255);

                // Scale the sphere based on low frequency average
                let scale = lowFreqAverage / 128;
                sphere.scaling.x = sphere.scaling.y = sphere.scaling.z = 1 + scale;

                let colorIntensity = highFreqAverage / 255 * 5;
                let redIntensity = Math.sin(colorIntensity * Math.PI);
                let greenIntensity = Math.cos(colorIntensity * Math.PI);
                let blueIntensity = 1 - colorIntensity;
                material.diffuseColor = new Color3(redIntensity, greenIntensity, blueIntensity);
            }
            scene.render();
        };
        //End Create Render excute function

        engine.runRenderLoop(runRenderLoop);

        window.addEventListener('resize', () => {
            engine.resize();
        });

        return () => {
            engine.stopRenderLoop(runRenderLoop);
            engine.dispose();
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(e => console.log('Error closing AudioContext:', e));
            }
        };
    }, [audioContext, analyser]);

    const startAudio = async () => {
        if (!audioContext) {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            setAudioContext(context);
            const analyserNode = context.createAnalyser();
            setAnalyser(analyserNode);

            try {
                const response = await fetch('3.mp3');
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await context.decodeAudioData(arrayBuffer);

                const { bpm: detectedBpm } = await guess(audioBuffer);
                console.log('Detected BPM:', detectedBpm);
                setBpm(detectedBpm);
                setIsReady(true);

                // BPM Scale Animation
                const frameRate = 60;
                const animationTime = 60 / detectedBpm * 2;
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
                        { frame: totalFrames / 2, value: 1.5 },
                        { frame: totalFrames, value: 0.7 }
                    ];
                    animation.setKeys(keyFrames);
                    return animation;
                });
                if (sphereRef.current) {
                    const sphere = sphereRef.current;
                    sphere.animations = animations;
                    sphere.getScene().beginAnimation(sphere, 0, totalFrames, true);
                }
                //End BPM Scale Animation

                const source = context.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(analyserNode);
                analyserNode.connect(context.destination);
                source.start(0);
                source.onended = () => console.log("Audio playback finished.");
            } catch (error) {
                console.error('Error processing audio file:', error);
            }
        }
    };


    return (
        <>
            <canvas ref={canvasRef} style={{ width: '800px', height: '600px' }} />
            <button onClick={startAudio}>Start Audio</button>
        </>
    );
}

export default AudioSphere3;
