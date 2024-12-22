/**
 * UI 관련 클래스 (UI.js)
 * - 마우스/키보드 이벤트 처리
 * - 카메라(시점) 상태와 행렬 업데이트
 * - 외부에서 UI.matrices.VP 등을 사용해 최종 투영행렬 획득 가능
 */

import { vec2, vec3, mat4, utils } from "wgpu-matrix";
import { unproject_vector } from "./utils.js";

/**
 * UI 클래스
 * - 정적(static) 멤버만 보유하여 어디서든 쉽게 접근 가능
 * - 이벤트 핸들러(onmousedown, onmousemove 등)와 카메라/행렬 상태 관리
 */
export class UI {
  // 마우스 이동 모드에 대한 상수
  static NONE = 0;
  static ROTATING = 1;
  static TRANSLATING = 2;

  // 현재 마우스 이동 모드 (NONE, ROTATING, TRANSLATING)
  static mouseMove = UI.NONE;

  // 카메라 상태(시야각, 위치, 클리핑 평면 등)
  static camera = {
    fovy: 45,
    position: vec3.create(-0.2, -0.5, -4),
    near: 0.1,
    far: 100,
  };

  // 행렬들(투영행렬 P, 회전행렬 R, 최종 VP 등)
  static matrices = { P: null, R: null, VP: null };

  /**
   * 마우스 다운 핸들러
   * - ctrl/meta키(혹은 cmd키) 눌려 있으면 TRANSLATING, 없으면 ROTATING
   */
  static onmousedown(ev) {
    if (ev.buttons === 1) {
      if (ev.metaKey || ev.ctrlKey) UI.mouseMove = UI.TRANSLATING;
      else UI.mouseMove = UI.ROTATING;
    }
  }

  /** 마우스 업 핸들러 - 마우스 이동 모드 해제 */
  static onmouseup(ev) {
    UI.mouseMove = UI.NONE;
  }

  /**
   * 마우스 이동 핸들러
   * - ROTATING 모드: 마우스 이동량에 따라 카메라 회전행렬 갱신
   * - TRANSLATING 모드: 마우스 이동량에 따라 카메라 위치 이동
   */
  static onmousemove(ev) {
    let offset = [ev.movementX, ev.movementY];
    if (UI.mouseMove == UI.ROTATING) {
      UI.update_VP();
      // 드래그 벡터를 3D 회전축으로 변환
      let axis = unproject_vector([offset[1], offset[0], 0], UI.matrices.VP, [
        0,
        0,
        UI.canvas.clientWidth,
        UI.canvas.clientHeight,
      ]);
      // 회전행렬 갱신
      UI.matrices.R = mat4.rotate(
        UI.matrices.R,
        [axis[0], axis[1], axis[2]],
        utils.degToRad(vec2.lenSq(offset) * 0.1)
      );
    } else if (UI.mouseMove == UI.TRANSLATING) {
      UI.update_VP();
      // 마우스 이동량을 실제 3D 카메라 평행이동으로 변환
      let by = unproject_vector([offset[0], -offset[1], 0], UI.matrices.VP, [
        0,
        0,
        UI.canvas.clientWidth,
        UI.canvas.clientHeight,
      ]);
      UI.camera.position = vec3.add(
        UI.camera.position,
        vec3.transformMat4(vec3.create(by[0], by[1], by[2]), UI.matrices.R)
      );
    }
  }

  /**
   * 마우스 휠 핸들러
   * - 카메라 z축 위치로 줌 인/아웃 (최소1, 최대50 범위 제한)
   */
  static onwheel(ev) {
    ev.preventDefault();
    UI.camera.position[2] = -Math.max(
      1,
      Math.min(-UI.camera.position[2] + ev.deltaY * 0.01, 50)
    );
    UI.update_VP();
  }

  /**
   * UI.matrices.VP 갱신
   * - 투영행렬(P)와 카메라 회전행렬(R), 위치 등을 반영해 최종 VP 구성
   */
  static update_VP() {
    UI.matrices.P = mat4.perspective(
      utils.degToRad(UI.camera.fovy),
      UI.canvas.width / UI.canvas.height,
      UI.camera.near,
      UI.camera.far
    );
    if (!UI.matrices.R) UI.matrices.R = mat4.identity();

    let T = mat4.translate(UI.matrices.P, UI.camera.position);
    UI.matrices.VP = mat4.multiply(T, UI.matrices.R);
  }
}
