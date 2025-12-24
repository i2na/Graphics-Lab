import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

/**
 * 메인 함수: Three.js 씬을 초기화하고, 손 모델을 생성하며, 슬라이더와 GUI를 설정합니다.
 */
function main() {
    // 캔버스 선택 및 렌더러 초기화
    const canvas = document.querySelector("#threejs");
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

    // 카메라 설정 (Orthographic Camera)
    const near = 0.1;
    const far = 100;
    const size = 10;
    const camera = new THREE.OrthographicCamera(-size, size, size, -size, near, far);
    camera.position.set(0, 10, 20);

    // OrbitControls를 사용하여 카메라 제어
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 5, 0);
    controls.update();

    // 씬 생성 및 배경색 설정
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("black");

    // 기본 기하학 형상과 기본 재질 설정 (음영 처리 가능)
    const geom = new THREE.CylinderGeometry(1, 1, 2, 16);
    const mat_base = new THREE.MeshPhongMaterial({ color: "#888" }); // 기본 회색 재질

    // 손의 기본 구조를 담을 Object3D 생성
    const base = new THREE.Object3D();
    scene.add(base);

    // 그리드 헬퍼 추가 (바닥)
    const grid_base = new THREE.GridHelper(30, 30);
    grid_base.renderOrder = 1; // 그리드가 다른 객체들보다 먼저 렌더링되도록 설정
    scene.add(grid_base);

    // 손의 베이스 메쉬 생성 및 위치 설정
    const mesh_base = new THREE.Mesh(geom, mat_base);
    mesh_base.scale.set(1, 0.5, 1);
    base.add(mesh_base);

    // 베이스의 Y 위치 설정
    base.position.y = mesh_base.scale.y;

    // 팔목(Palm) 설정
    const palmPivot = new THREE.Object3D();
    palmPivot.position.y = mesh_base.scale.y;
    base.add(palmPivot);

    const mesh_palm = new THREE.Mesh(geom, mat_base);
    mesh_palm.scale.set(3.8, 3, 1);
    mesh_palm.position.y = mesh_palm.scale.y;
    palmPivot.add(mesh_palm);

    // --- Thumb Rotation Variables ---
    let thumbJoint1RotationX = 0;
    let thumbJoint2RotationZ = THREE.MathUtils.degToRad(20); // 초기값과 동일하게 설정
    let thumbFingersRotationX = 0;
    let thumbFingersRotationZ = 0;

    /**
     * 엄지손가락의 최종 회전 값을 업데이트하는 함수
     */
    function updateThumbRotation() {
        // 엄지손가락의 회전 값을 합산
        thumbPivot.rotation.x = thumbJoint1RotationX + thumbFingersRotationX;
        thumbPivot.rotation.z = thumbJoint2RotationZ + thumbFingersRotationZ;
    }

    // --- Thumb Finger (엄지손가락) ---
    // Thumb Finger (Bottom)
    const thumbPivotObj = new THREE.Object3D();
    thumbPivotObj.position.y = mesh_palm.scale.y / 1.5;
    thumbPivotObj.position.x = -mesh_palm.scale.x - 0.7;
    thumbPivotObj.rotation.z = THREE.MathUtils.degToRad(20);
    palmPivot.add(thumbPivotObj);

    const mesh_thumb = new THREE.Mesh(geom, mat_base);
    mesh_thumb.scale.set(0.7, 1.3, 0.7);
    mesh_thumb.position.y = mesh_thumb.scale.y;
    thumbPivotObj.add(mesh_thumb);

    // Thumb Finger (Middle)
    const thumbMiddlePivot = new THREE.Object3D();
    thumbMiddlePivot.position.y = mesh_thumb.scale.y * 2;
    thumbPivotObj.add(thumbMiddlePivot);

    const mesh_thumb_middle = new THREE.Mesh(geom, mat_base);
    mesh_thumb_middle.scale.set(0.7, 1.3, 0.7);
    mesh_thumb_middle.position.y = mesh_thumb_middle.scale.y;
    thumbMiddlePivot.rotation.z = 0;
    thumbMiddlePivot.add(mesh_thumb_middle);

    // 초기 엄지손가락 회전 설정
    updateThumbRotation();

    // --- Index Finger (검지) ---
    // Index Finger (Bottom)
    const indexPivot = new THREE.Object3D();
    indexPivot.position.x = -mesh_palm.scale.x + 0.6;
    indexPivot.position.y = mesh_palm.scale.y * 2;
    palmPivot.add(indexPivot);

    const mesh_index = new THREE.Mesh(geom, mat_base);
    mesh_index.scale.set(0.6, 0.9, 0.6);
    mesh_index.position.y = mesh_index.scale.y;
    indexPivot.add(mesh_index);

    // Index Finger (Middle)
    const indexMiddlePivot = new THREE.Object3D();
    indexMiddlePivot.position.y = mesh_index.scale.y * 2;
    indexPivot.add(indexMiddlePivot);

    const mesh_index_middle = new THREE.Mesh(geom, mat_base);
    mesh_index_middle.scale.set(0.6, 0.9, 0.6);
    mesh_index_middle.position.y = mesh_index_middle.scale.y;
    indexMiddlePivot.add(mesh_index_middle);

    // Index Finger (Top)
    const indexTopPivot = new THREE.Object3D();
    indexTopPivot.position.y = mesh_index_middle.scale.y * 2;
    indexMiddlePivot.add(indexTopPivot);

    const mesh_index_top = new THREE.Mesh(geom, mat_base);
    mesh_index_top.scale.set(0.6, 0.9, 0.6);
    mesh_index_top.position.y = mesh_index_top.scale.y;
    indexTopPivot.add(mesh_index_top);

    // --- Middle Finger (중지) ---
    // Middle Finger (Bottom)
    const middlePivot = new THREE.Object3D();
    middlePivot.position.x = indexPivot.position.x + ((mesh_palm.scale.x - 0.6) * 2) / 3;
    middlePivot.position.y = mesh_palm.scale.y * 2;
    palmPivot.add(middlePivot);

    const mesh_middle = new THREE.Mesh(geom, mat_base);
    mesh_middle.scale.set(0.6, 1.1, 0.6);
    mesh_middle.position.y = mesh_middle.scale.y;
    middlePivot.add(mesh_middle);

    // Middle Finger (Middle)
    const middleMiddlePivot = new THREE.Object3D();
    middleMiddlePivot.position.y = mesh_middle.scale.y * 2;
    middlePivot.add(middleMiddlePivot);

    const mesh_middle_middle = new THREE.Mesh(geom, mat_base);
    mesh_middle_middle.scale.set(0.6, 1.1, 0.6);
    mesh_middle_middle.position.y = mesh_middle_middle.scale.y;
    middleMiddlePivot.add(mesh_middle_middle);

    // Middle Finger (Top)
    const middleTopPivot = new THREE.Object3D();
    middleTopPivot.position.y = mesh_middle_middle.scale.y * 2;
    middleMiddlePivot.add(middleTopPivot);

    const mesh_middle_top = new THREE.Mesh(geom, mat_base);
    mesh_middle_top.scale.set(0.6, 1.1, 0.6);
    mesh_middle_top.position.y = mesh_middle_top.scale.y;
    middleTopPivot.add(mesh_middle_top);

    // --- Ring Finger (약지) ---
    // Ring Finger (Bottom)
    const ringPivot = new THREE.Object3D();
    ringPivot.position.x = middlePivot.position.x + ((mesh_palm.scale.x - 0.6) * 2) / 3;
    ringPivot.position.y = mesh_palm.scale.y * 2;
    palmPivot.add(ringPivot);

    const mesh_ring = new THREE.Mesh(geom, mat_base);
    mesh_ring.scale.set(0.6, 0.9, 0.6);
    mesh_ring.position.y = mesh_ring.scale.y;
    ringPivot.add(mesh_ring);

    // Ring Finger (Middle)
    const ringMiddlePivot = new THREE.Object3D();
    ringMiddlePivot.position.y = mesh_ring.scale.y * 2;
    ringPivot.add(ringMiddlePivot);

    const mesh_ring_middle = new THREE.Mesh(geom, mat_base);
    mesh_ring_middle.scale.set(0.6, 0.9, 0.6);
    mesh_ring_middle.position.y = mesh_ring_middle.scale.y;
    ringMiddlePivot.add(mesh_ring_middle);

    // Ring Finger (Top)
    const ringTopPivot = new THREE.Object3D();
    ringTopPivot.position.y = mesh_ring_middle.scale.y * 2;
    ringMiddlePivot.add(ringTopPivot);

    const mesh_ring_top = new THREE.Mesh(geom, mat_base);
    mesh_ring_top.scale.set(0.6, 0.9, 0.6);
    mesh_ring_top.position.y = mesh_ring_top.scale.y;
    ringTopPivot.add(mesh_ring_top);

    // --- Small Finger (소지) ---
    // Small Finger (Bottom)
    const smallPivot = new THREE.Object3D();
    smallPivot.position.x = mesh_palm.scale.x - 0.6;
    smallPivot.position.y = mesh_palm.scale.y * 2;
    palmPivot.add(smallPivot);

    const mesh_small = new THREE.Mesh(geom, mat_base);
    mesh_small.scale.set(0.6, 0.7, 0.6);
    mesh_small.position.y = mesh_small.scale.y;
    smallPivot.add(mesh_small);

    // Small Finger (Middle)
    const smallMiddlePivot = new THREE.Object3D();
    smallMiddlePivot.position.y = mesh_small.scale.y * 2;
    smallPivot.add(smallMiddlePivot);

    const mesh_small_middle = new THREE.Mesh(geom, mat_base);
    mesh_small_middle.scale.set(0.6, 0.7, 0.6);
    mesh_small_middle.position.y = mesh_small_middle.scale.y;
    smallMiddlePivot.add(mesh_small_middle);

    // Small Finger (Top)
    const smallTopPivot = new THREE.Object3D();
    smallTopPivot.position.y = mesh_small_middle.scale.y * 2;
    smallMiddlePivot.add(smallTopPivot);

    const mesh_small_top = new THREE.Mesh(geom, mat_base);
    mesh_small_top.scale.set(0.6, 0.7, 0.6);
    mesh_small_top.position.y = mesh_small_top.scale.y;
    smallTopPivot.add(mesh_small_top);

    // 초기 엄지손가락 회전 설정
    updateThumbRotation();

    /**
     * 슬라이더 변경 이벤트 핸들러: 슬라이더의 값을 기반으로 손 모델의 회전을 업데이트합니다.
     * @param {Event} event - 이벤트 객체
     * @param {Object} ui - UI 객체
     */
    function onChange(event, ui) {
        const id = event.target.id;
        const value = $("#" + id).slider("value");
        const radians = THREE.MathUtils.degToRad(value);

        // 로그 업데이트
        document.querySelector("#log").innerHTML = `${id}: ${value}`;

        // 회전 매핑 객체: 슬라이더 ID에 따른 회전 동작을 정의
        const rotationMapping = {
            "slider-wrist-twist": () => (palmPivot.rotation.y = radians),
            "slider-wrist-bend": () => (palmPivot.rotation.x = -radians),
            "slider-thumb-joint2": () => {
                thumbJoint1RotationX = -radians;
                thumbJoint2RotationZ = THREE.MathUtils.degToRad(20) - radians;
                updateThumbRotation();
            },
            "slider-thumb-joint1": () => {
                thumbMiddlePivot.rotation.x = -radians;
                thumbMiddlePivot.rotation.z = -radians;
            },
            "slider-index-joint3": () => (indexPivot.rotation.x = -radians),
            "slider-index-joint2": () => (indexMiddlePivot.rotation.x = -radians),
            "slider-index-joint1": () => (indexTopPivot.rotation.x = -radians),
            "slider-middle-joint3": () => (middlePivot.rotation.x = -radians),
            "slider-middle-joint2": () => (middleMiddlePivot.rotation.x = -radians),
            "slider-middle-joint1": () => (middleTopPivot.rotation.x = -radians),
            "slider-ring-joint3": () => (ringPivot.rotation.x = -radians),
            "slider-ring-joint2": () => (ringMiddlePivot.rotation.x = -radians),
            "slider-ring-joint1": () => (ringTopPivot.rotation.x = -radians),
            "slider-small-joint3": () => (smallPivot.rotation.x = -radians),
            "slider-small-joint2": () => (smallMiddlePivot.rotation.x = -radians),
            "slider-small-joint1": () => (smallTopPivot.rotation.x = -radians),
            "slider-fingers": () => {
                thumbFingersRotationZ = radians * 1.5;
                indexPivot.rotation.z = radians * 1.5;
                middlePivot.rotation.z = radians * 0.7;
                ringPivot.rotation.z = -radians * 0.7;
                smallPivot.rotation.z = -radians * 1.5;

                updateThumbRotation();
            },
        };

        // 해당 ID의 회전 동작 실행
        if (rotationMapping[id]) {
            rotationMapping[id]();
        }
    }

    /**
     * 엄지손가락의 최종 회전 값을 업데이트하는 함수
     */
    function updateThumbRotation() {
        // 엄지손가락의 회전 값을 합산
        thumbPivotObj.rotation.x = thumbJoint1RotationX + thumbFingersRotationX;
        thumbPivotObj.rotation.z = thumbJoint2RotationZ + thumbFingersRotationZ;
    }

    // --- 조명 설정 ---
    {
        // 방향성 조명 (Directional Light): 강한 빛과 그림자 생성
        const color = 0xffffff;
        const intensity = 1;
        const directionalLight = new THREE.DirectionalLight(color, intensity);
        directionalLight.position.set(0, 10, 0);
        directionalLight.target.position.set(-5, 0, 0);
        scene.add(directionalLight);
        scene.add(directionalLight.target);
    }
    {
        // 주변 조명 (Ambient Light): 전체적인 조명 제공
        const color = 0xffffff;
        const intensity = 0.1;
        const ambientLight = new THREE.AmbientLight(color, intensity);
        scene.add(ambientLight);
    }

    /**
     * 렌더러 크기 조정 함수: 창 크기에 맞게 렌더러의 크기를 조정합니다.
     * @param {THREE.WebGLRenderer} renderer - 렌더러 객체
     * @returns {boolean} 크기 조정이 필요하면 true, 아니면 false
     */
    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }

        return needResize;
    }

    /**
     * 렌더링 루프: 씬을 렌더링하고 애니메이션을 지속적으로 업데이트합니다.
     */
    function render() {
        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.left = -size;
            camera.right = size;
            camera.top = size;
            camera.bottom = -size;
            camera.updateProjectionMatrix();
        }

        renderer.render(scene, camera);

        requestAnimationFrame(render);
    }

    // 렌더링 시작
    requestAnimationFrame(render);

    // 슬라이더 설정 배열
    const sliders = [
        // Thumb joints
        {
            id: "slider-thumb-joint1",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-thumb-joint2",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        // Index joints
        {
            id: "slider-index-joint1",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-index-joint2",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-index-joint3",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        // Middle joints
        {
            id: "slider-middle-joint1",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-middle-joint2",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-middle-joint3",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        // Ring joints
        {
            id: "slider-ring-joint1",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-ring-joint2",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-ring-joint3",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        // Small joints
        {
            id: "slider-small-joint1",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-small-joint2",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        {
            id: "slider-small-joint3",
            orientation: "vertical",
            min: 0,
            max: 45,
            value: 0,
        },
        // Wrist and fingers
        {
            id: "slider-wrist-bend",
            orientation: "vertical",
            min: -45,
            max: 45,
            value: 0,
        },
        {
            id: "slider-fingers",
            orientation: "horizontal",
            min: 0,
            max: 10,
            value: 0,
        },
        {
            id: "slider-wrist-twist",
            orientation: "horizontal",
            min: 0,
            max: 360,
            value: 0,
        },
    ];

    // 슬라이더 초기화
    for (let slider of sliders) {
        $("#" + slider.id).slider({
            orientation: slider.orientation,
            range: "min",
            min: slider.min,
            max: slider.max,
            value: slider.value,
            slide: onChange,
        });
    }

    /**
     * GUI 설정 함수: 손 전체의 색상을 변경할 수 있는 GUI 컨트롤을 추가합니다.
     * @param {THREE.MeshPhongMaterial} material - 손 전체에 사용되는 재질 객체
     */
    function setupGUI(material) {
        const gui = new GUI();
        const colorController = { color: material.color.getStyle() };

        // GUI 폴더 생성
        const folder = gui.addFolder("손 색상 설정");

        // 색상 컨트롤 추가
        folder
            .addColor(colorController, "color")
            .name("손 색상")
            .onChange((value) => {
                material.color.setStyle(value);
            });

        folder.open();
    }

    /**
     * 문자열의 첫 글자를 대문자로 변환하는 함수
     * @param {string} str - 입력 문자열
     * @returns {string} 변환된 문자열
     */
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // GUI 설정: 손 전체의 재질을 전달하여 색상 변경 기능 추가
    setupGUI(mat_base);
}

// 메인 함수 실행
main();
