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
    ExecuteCodeAction,
    Sound
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { guess } from 'web-audio-beat-detector';
import vertShader from './shaders/sampleShader.vert?raw';
import fragShader from './shaders/sampleShader.frag?raw';

function AudioSphere10() {
    const canvasRef = useRef(null);
    const musicPath = ['1.mp3', '2.mp3', '3.mp3', '4.mp3', '5.mp3'];
    const icospheres = useRef(null);
    let currentTime = 0;
    const time = 0.01;

    useEffect(() => {
        const engine = new Engine(canvasRef.current, true);
        const scene = new Scene(engine);

        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 20, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);
        const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);

        scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: 'immersive-ar',
            },
        });

        const setupIcoSpheres = async () => {
            const icospherePromise = musicPath.map(async (path, index) => {
                const icosphere = MeshBuilder.CreateIcoSphere(`icosphere${index}`, { radius: 1, subdivisions: 4 }, scene);
                icosphere.position.x = new Vector3(index * 12, 0, 60);
                icosphere.musicPath = path;
                const material = new StandardMaterial(`material${index}`, scene);
                material.diffuseColor = new Color3(1, 0, 0);
                //material.backFaceCulling = false;
                //material.fillMode = Material.WireFrameFillMode;
                icosphere.material = material;

                const music = new Sound(`music${index}`, path, scene, null, { loop: true, autoplay: false });
                music.rolloffFactor = 2;
                music.maxDistance = 50;
                music.distanceModel = 'linear';
                music.attachToMesh(icosphere);

                icosphere.isPlaying = false;
                icosphere.actionManager = new ActionManager(scene);
                icosphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, async () => {
                    if (music.isPlaying) {
                        music.pause();
                        icosphere.isPlaying = false;
                    } else {
                        music.play();
                        icosphere.isPlaying = true;
                    }
                }));
                icospheres.current.push(icosphere);
                return icosphere;
            });
            return await Promise.all(icospherePromise);
        };
        setupIcoSpheres();

        engine.runRenderLoop(() => {
            scene.render();
        });

        return () => {
            scene.dispose();
            engine.dispose();
        };
    });
    return (
        <>
            <canvas ref={canvasRef} style={{ width: '800px', height: '600px' }} />
        </>
    );
}

export default AudioSphere10;