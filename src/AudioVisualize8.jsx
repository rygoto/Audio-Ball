import React, { useEffect, useRef } from 'react';
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
    ExecuteCodeAction,
    Sound,
    Analyser,
} from '@babylonjs/core';

function AudioSphere8() {
    const canvasRef = useRef(null);
    const audioContext = new window.AudioContext();

    async function setupAudio(audioContext, musicPath) {
        const response = await fetch(musicPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        return { source, analyser };
    }

    useEffect(() => {
        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);
        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 20, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);

        const musicPaths = ["1.mp3", "3.mp3"];
        musicPaths.forEach(async (path, index) => {
            const { source, analyser } = await setupAudio(audioContext, path);
            const icosphere = MeshBuilder.CreateIcoSphere(`icosphere${index}`, { radius: 1, subdivisions: 4 }, scene);
            icosphere.position = new Vector3(index * 80, 0, 0);

            const music = new Sound(`music${index}`, path, scene, null, { autoplay: false, loop: true, spatialSound: true });
            music.attachToMesh(icosphere);

            icosphere.actionManager = new ActionManager(scene);
            icosphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
                if (music.isPlaying) {
                    music.pause();
                    source.stop();
                } else {
                    music.play();
                    source.start();
                }
            }));
        });

        engine.runRenderLoop(() => {
            scene.render();
        });

        return () => {
            engine.stopRenderLoop();
            engine.dispose();
        };
    }, []);

    return (
        <canvas ref={canvasRef} style={{ width: '800px', height: '600px' }} />
    );
}

export default AudioSphere8;
