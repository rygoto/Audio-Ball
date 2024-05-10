import React, { useEffect, useRef, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, Mesh, MeshBuilder, ActionManager, ExecuteCodeAction, WebXRState, WebXRDomOverlay, AxesViewer, StandardMaterial, Color3 } from '@babylonjs/core';

function BabylonScene() {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            const engine = new Engine(canvasRef.current, true);
            const scene = new Scene(engine);
            const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);
            const spheres = [];
            const audioFiles = ['2.mp3', '3.mp3', '4.mp3', '5.mp3', '6.mp3'];


            for (let i = 0; i < 5; i++) {
                const sphere = MeshBuilder.CreateSphere("sphere" + i, { diameter: 1, segments: 16 }, scene);
                sphere.position = new Vector3(-2 + i * 2, 2, 18);
                const material = new StandardMaterial("material" + i, scene);
                sphere.material = material;
                sphere.actionManager = new ActionManager(scene);
                const audio = new Audio(audioFiles[i]);
                sphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
                    // ここにトリガーされたときのアクションを記述
                    if (!audio.paused) {
                        audio.pause();
                        audio.currentTime = 0;
                    } else {
                        audio.play();
                    }
                    sphere.material.diffuseColor = new Color3(Math.random(), Math.random(), Math.random());
                }));
                spheres.push(sphere);
            }

            scene.createDefaultXRExperienceAsync({
                uiOptions: {
                    sessionMode: 'immersive-ar',
                },
            }).then((experience) => {
                camera = experience.baseExperience.camera;  // XRカメラを使用
                //sphere.position = camera.getFrontPosition(2);  // カメラの前方2mに配置
            });

            const axesViewer = new AxesViewer(scene);

            engine.runRenderLoop(() => {
                scene.render();
                spheres.forEach(sphere => {
                    sphere.position.z -= 0.015;
                });
            });

            return () => {
                engine.dispose();
            };
        }
    }, []);

    return (
        <>
            <canvas ref={canvasRef} style={{ width: '800px', height: '600px' }} />
        </>
    );
}

export default BabylonScene;