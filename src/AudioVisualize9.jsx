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
    Sound,
    Analyser,
    Angle,
    AnimationGroup,
    Texture,
    GlowLayer,
    HighlightLayer
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { guess } from 'web-audio-beat-detector';
import vertShader from './shaders/sampleShader.vert?raw';
import fragShader from './shaders/sampleShader.frag?raw';

function AudioSphere9() {
    const canvasRef = useRef(null);
    const musicPaths = ["2.mp3", "8.mp3", "3.mp3"];
    const icospheres = useRef([]);
    let currentTime = 0.0;
    const timeIncrement = 0.01;

    useEffect(() => {
        let isCancelled = false;
        let currentAnimations = [];
        const engine = new Engine(canvasRef.current, true, { stencil: true });
        const scene = new Scene(engine);
        let sphereAnimationGroup = null;
        const gl = new GlowLayer("glow", scene);
        gl.intensity = 1.5;
        const hl = new HighlightLayer("hl", scene);


        const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2, 20, Vector3.Zero(), scene);
        camera.attachControl(canvasRef.current, true);
        const light = new HemisphericLight("light", new Vector3(1, 1, 0), scene);

        scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: 'immersive-ar',
            },
        });

        function animateSphere(bpm, icosphere) {
            const frameRate = 60;
            const animationTime = 60 / bpm; // Duration of one beat
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
                    { frame: totalFrames * 0.1 / 2, value: 1.2 },
                    { frame: totalFrames, value: 0.7 }
                ];
                animation.setKeys(keyFrames);
                return animation;
            });

            sphereAnimationGroup = new AnimationGroup("sphereScalingGroup");
            animations.forEach(animation => sphereAnimationGroup.addTargetedAnimation(animation, icosphere));
            sphereAnimationGroup.start(true, 1, sphereAnimationGroup.from, sphereAnimationGroup.to, false);
        }
        function stopSphereAnimation() {
            if (sphereAnimationGroup && sphereAnimationGroup.isPlaying) {
                sphereAnimationGroup.stop();
            }
        }

        const setupIcoSpheres = async () => {
            const icospherePromises = musicPaths.map(async (path, index) => {
                const icosphere = MeshBuilder.CreateIcoSphere(`sphere${index}`, { radius: 3.5, subdivisions: 7 }, scene);

                icosphere.index = index;
                icosphere.musicPath = path;
                icosphere.position = new Vector3(index * 12, 0, 100);
                const material = new StandardMaterial(`material${index}`, scene);
                material.diffuseColor = new Color3(1, 0, 0);
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
                //icosphere.material = material;
                shaderMaterial.setFloat('u_time', 0.0);
                shaderMaterial.setFloat('u_low_frequency', 0.0);
                shaderMaterial.setFloat('u_high_frequency', 0.0);
                shaderMaterial.setFloat('u_all_frequency', 0.0);
                shaderMaterial.setFloat('u_red', 0.0);
                shaderMaterial.setFloat('u_green', 0.0);
                shaderMaterial.setFloat('u_blue', 0.0);
                //hl.addMesh(icosphere, Color3.Green());

                const icosphere2 = MeshBuilder.CreateIcoSphere(`sphere${index}`, { radius: 3, subdivisions: 3 }, scene);
                icosphere2.parent = icosphere;
                icosphere2.position = new Vector3(0, 0, 0);
                const material2 = new StandardMaterial(`material${index}`, scene);
                material2.diffuseColor = new Color3(1, 1, 0);
                material2.wireframe = true;
                icosphere2.material = material2;
                //hl.addMesh(icosphere2, Color3.Red());

                const sphere = MeshBuilder.CreateSphere(`sphere${index}`, { diameter: 9 }, scene);
                const material3 = new StandardMaterial(`material${index}`, scene);
                const texturePath = `${index + 1}.png`;
                const texture = new Texture(texturePath, scene);
                material3.diffuseTexture = texture;
                //material3.diffuseColor = new Color3(0, 1, 0);
                sphere.material = material3;
                sphere.parent = icosphere2;

                //bablons audioの設定
                const music = new Sound(`music${index}`, path, scene, null, { autoplay: false, loop: true, spatialSound: true });
                music.rolloffFactor = 2; // 音量の減衰率
                music.maxDistance = 50; // 最大聞こえる距離
                music.distanceModel = 'linear'; // 距離減衰モデル
                music.attachToMesh(icosphere);
                icosphere.audio = music;

                icosphere.isPlaying = false;
                sphere.actionManager = new ActionManager(scene);
                sphere.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, async () => {
                    if (music.isPlaying) {
                        music.pause();
                        icosphere.isPlaying = false;
                        icosphere.position = new Vector3(index * 12, 0, 0);
                        sphere.isVisible = true;
                    } else {
                        music.play();
                        icosphere.isPlaying = true;
                        sphere.isVisible = false;
                        let moveAnimation = new Animation("moveAnimation", "position", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);
                        let keys = [];
                        keys.push({
                            frame: 0,
                            value: icosphere.position
                        });
                        keys.push({
                            frame: 15,
                            value: new Vector3(0, 0, 0)
                        });
                        moveAnimation.setKeys(keys);

                        // Run animation
                        icosphere.animations = [];
                        icosphere.animations.push(moveAnimation);
                        scene.beginAnimation(icosphere, 0, 15, false);

                        if (music.isReady()) { // 音楽が準備完了しているか確認
                            let audioBuffer = music.getAudioBuffer(); // Babylon.js の Sound オブジェクトから AudioBuffer を取得
                            if (audioBuffer) {
                                try {
                                    const tempo = await guess(audioBuffer);
                                    console.log('Detected BPM:', tempo.bpm);
                                    animateSphere(tempo.bpm, icosphere2);
                                } catch (error) {
                                    console.error('Error detecting tempo:', error);
                                }
                            }
                        }
                    }
                }));//ここのsphere再生ロジックは保留(クリックの度にaudioPropsが生成されるため、sphere.audio.stopにアクセスできない)
                icosphere2.actionManager = new ActionManager(scene);
                icosphere2.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, async () => {
                    if (music.isPlaying) {
                        music.pause();
                        icosphere.isPlaying = false;
                        icosphere.position = new Vector3(index * 12, 0, 0);
                        sphere.isVisible = true;
                        icosphere.material.setFloat('u_time', 0.0);
                        icosphere.material.setFloat('u_low_frequency', 0.0);
                        icosphere.material.setFloat('u_high_frequency', 0.0);
                        icosphere.material.setFloat('u_all_frequency', 0.0);
                        stopSphereAnimation(icosphere2);
                    }
                }));
                icospheres.current.push(icosphere);
                return icosphere;
            });

            return await Promise.all(icospherePromises);
        };

        setupIcoSpheres();

        const transformBalls = (icospheres) => {
            icospheres.forEach((icosphere, i) => {
                icosphere.position.z += 0.05;
                if (icosphere.position.z > 60) {
                    icosphere.position.z = 0;
                }
            });
        };
        const transformBall = (icosphere, i) => {
            const velocity = 3;
            icosphere.position.z -= 0.05 * velocity;
            const radius = 10;
            const angle = Math.PI / 3;
            const targetX = radius * Math.cos(angle * i);
            const targetY = radius * Math.sin(angle * i);
            const forwardY = targetY * 0.05 / 100 * velocity;
            const forwardX = targetX * 0.05 / 100 * velocity;
            icosphere.position.x += forwardX;
            icosphere.position.y += forwardY;
            if (icosphere.position.z < 0) {
                icosphere.position.z = 100;
                icosphere.position.x = 0;
                icosphere.position.y = 0;
            }
        };

        const analyser = new Analyser(scene);
        Engine.audioEngine.connectToAnalyser(analyser);
        const audioContext = Engine.audioEngine.audioContext;
        const audioBuffer = audioContext.createBufferSource();
        //console.log("audioBuffer", audioBuffer);

        engine.runRenderLoop(() => {
            currentTime += timeIncrement;

            analyser.drawDebugCanvas();
            // FFTサイズを設定（例：512）
            analyser.FFT_SIZE = 512;
            analyser.SMOOTHING = 0.8;

            const dataArray = analyser.getByteFrequencyData();
            const bufferLength = analyser.getFrequencyBinCount();
            analyser.getByteFrequencyData(dataArray);

            const lowFreqAverage = dataArray.slice(0, bufferLength / 3).reduce((acc, cur) => acc + cur, 0) / (bufferLength / 3);    // 低周波数域   0 ~ 1000Hz
            const middleFreqAverage = dataArray.slice(bufferLength / 3, bufferLength * 2 / 3).reduce((acc, cur) => acc + cur, 0) / (bufferLength / 3);    // 中周波数域 1000 ~ 2000Hz       
            const highFreqAverage = dataArray.slice(bufferLength * 2 / 3, bufferLength).reduce((acc, cur) => acc + cur, 0) / (bufferLength / 3);    // 高周波数域 2000 ~ 3000Hz 
            const allFreqAverage = dataArray.reduce((acc, cur) => acc + cur, 0) / bufferLength;    // 全周波数域 0 ~ 3000Hz

            icospheres.current.forEach((icosphere, i) => {
                icosphere.startTime = currentTime + Math.random() * 5;
                //console.log("icosphere.startTime", icosphere.startTime);
                if (!icosphere.isPlaying) {
                    transformBall(icosphere, i);
                }
                else if (icosphere.isPlaying) {
                    icosphere.material.setFloat('u_time', currentTime);
                    icosphere.material.setFloat('u_low_frequency', lowFreqAverage);
                    icosphere.material.setFloat('u_high_frequency', highFreqAverage);
                    icosphere.material.setFloat('u_all_frequency', allFreqAverage);
                    icosphere.material.setFloat('u_red', highFreqAverage / 255.0 * 2.0);
                    icosphere.material.setFloat('u_green', lowFreqAverage / 255.0);
                    icosphere.material.setFloat('u_blue', middleFreqAverage / 255.0);
                }
            })
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

export default AudioSphere9;
