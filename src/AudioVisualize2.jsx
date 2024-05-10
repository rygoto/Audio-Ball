import React, { useEffect, useRef, useState } from 'react';
import { Engine, Scene, Vector3, ArcRotateCamera, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Animation } from '@babylonjs/core';
import '@babylonjs/loaders';
import { guess } from 'web-audio-beat-detector';

function AudioSphere2() {
    const canvasRef = useRef(null);
    const [audioContext, setAudioContext] = useState(null);
    const [analyser, setAnalyser] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [bpm, setBpm] = useState(60);
    const sphereRef = useRef(null); // Reference to the sphere object

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

        const runRenderLoop = () => {
            /*if (analyser) {
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);

                let lowFreqAverage = dataArray.slice(0, bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);
                let highFreqAverage = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0) / (bufferLength / 2);

                let scale = lowFreqAverage / 128;
                sphere.scaling.x = sphere.scaling.y = sphere.scaling.z = 1 + scale;

                let colorIntensity = highFreqAverage / 255 * 5;
                let redIntensity = Math.sin(colorIntensity * Math.PI);
                let greenIntensity = Math.cos(colorIntensity * Math.PI);
                let blueIntensity = 1 - colorIntensity;
                material.diffuseColor = new Color3(redIntensity, greenIntensity, blueIntensity);
                //追加
                const bpmEffect = Math.sin(engine.getDeltaTime() * bpm / 60000 * Math.PI * 2) * 50;
                sphere.position.x = bpmEffect * 2;
            }*/
            scene.render();
        };

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

                // Initialize and start the animation
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

export default AudioSphere2;
