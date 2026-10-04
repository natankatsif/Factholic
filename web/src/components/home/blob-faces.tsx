import React from "react";

const C = "#00000059";

// Пружинящий переход при реакции на тап (bounce) и мягкий при возврате в норму (smooth-out)
const TRANS_REACT = "all 440ms cubic-bezier(0.34, 1.45, 0.64, 1)";
const TRANS_RETURN = "all 480ms cubic-bezier(0.22, 1, 0.36, 1)";

// Плавные переходы для слоёв лица при гибели и оживлении
const DEAD_LAYER_TRANS_ENTER = "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 460ms cubic-bezier(0.34, 1.45, 0.64, 1)";
const DEAD_LAYER_TRANS_EXIT = "opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 440ms cubic-bezier(0.22, 1, 0.36, 1)";

const LIVING_LAYER_TRANS_ENTER = "opacity 460ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.34, 1.45, 0.64, 1)";
const LIVING_LAYER_TRANS_EXIT = "opacity 380ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";


export interface FaceProps {
  isReacting: boolean;
  variant: number;
  hasText?: boolean;
  talking?: boolean;
  isDead?: boolean;
}

/** Крестик вместо глаза при гибели персонажа (X) */
export function DeadEye({
  left,
  top,
  size = 28,
  rotate = 0,
}: {
  left: number;
  top: number;
  size?: number;
  rotate?: number;
}) {
  return (
    <div
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${rotate}deg)`,
      }}
      className="absolute pointer-events-none select-none flex items-center justify-center"
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute w-full h-[5px] bg-[#00000080] rounded-full rotate-45" />
        <div className="absolute w-full h-[5px] bg-[#00000080] rounded-full -rotate-45" />
      </div>
    </div>
  );
}

/** Волнистый рот с высунутым набок язычком при гибели персонажа (~ язычок) */
export function DeadMouth({
  left,
  top,
  width = 54,
  height = 20,
}: {
  left: number;
  top: number;
  width?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      className="absolute pointer-events-none select-none flex items-center justify-center"
    >
      <svg
        viewBox="0 0 60 22"
        className="w-full h-full overflow-visible"
        fill="none"
        stroke="#00000075"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 4 11 Q 16 3, 28 11 T 56 11" />
      </svg>
      <div className="absolute -bottom-2.5 right-2 w-4 h-5 bg-[#FF6B8B] rounded-b-full border-2 border-[#00000045] rotate-12 shadow-sm" />
    </div>
  );
}

/* =========================================================================
   1. Blue Blob (240×240) - Плавный морфинг бровей, глаз и рта
   ========================================================================= */
export function BlueFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  // Исходное спокойное состояние
  let browL = { left: 48, top: 72, width: 48, height: 12, rotate: -15, br: 6 };
  let browR = { left: 144, top: 72, width: 48, height: 12, rotate: 15, br: 6 };
  let eyeL = { left: 60, top: 96, width: 24, height: 36, br: 12, rotate: 0 };
  let eyeR = { left: 156, top: 96, width: 24, height: 36, br: 12, rotate: 0 };
  let mouth = { left: 90, top: 156, width: 60, height: 24, br: 12, rotate: 0 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Радостная широкая улыбка ^_^
      browL = { left: 52, top: 60, width: 44, height: 10, rotate: -4, br: 5 };
      browR = { left: 144, top: 60, width: 44, height: 10, rotate: 4, br: 5 };
      eyeL = { left: 58, top: 104, width: 28, height: 14, br: 14, rotate: -4 };
      eyeR = { left: 154, top: 104, width: 28, height: 14, br: 14, rotate: 4 };
      mouth = { left: 80, top: 146, width: 80, height: 42, br: 24, rotate: 0 };
    } else if (variant === 2) {
      // 2. Удивление :O
      browL = { left: 48, top: 52, width: 46, height: 10, rotate: -2, br: 5 };
      browR = { left: 146, top: 52, width: 46, height: 10, rotate: 2, br: 5 };
      eyeL = { left: 56, top: 92, width: 34, height: 34, br: 17, rotate: 0 };
      eyeR = { left: 150, top: 92, width: 34, height: 34, br: 17, rotate: 0 };
      mouth = { left: 102, top: 146, width: 36, height: 46, br: 22, rotate: 0 };
    } else if (variant === 3) {
      // 3. Подмигивание и ухмылка ;)
      browL = { left: 50, top: 76, width: 42, height: 10, rotate: 4, br: 5 };
      browR = { left: 142, top: 62, width: 46, height: 11, rotate: 18, br: 5.5 };
      eyeL = { left: 56, top: 110, width: 32, height: 8, br: 4, rotate: 0 };
      eyeR = { left: 154, top: 94, width: 26, height: 38, br: 13, rotate: 0 };
      mouth = { left: 96, top: 152, width: 56, height: 22, br: 12, rotate: 12 };
    } else {
      // 4. Смех / восторг
      browL = { left: 52, top: 62, width: 44, height: 10, rotate: -18, br: 5 };
      browR = { left: 144, top: 62, width: 44, height: 10, rotate: 18, br: 5 };
      eyeL = { left: 60, top: 104, width: 26, height: 10, br: 8, rotate: -8 };
      eyeR = { left: 154, top: 104, width: 26, height: 10, br: 8, rotate: 8 };
      mouth = { left: 84, top: 144, width: 72, height: 44, br: 22, rotate: 0 };
    }
  } else if (hasText) {
    // При выборе / вводе текста: заинтригованная бровь и внимательный рот
    browL = { left: 50, top: 58, width: 46, height: 11, rotate: -6, br: 5.5 };
    browR = { left: 142, top: 74, width: 46, height: 11, rotate: 20, br: 5.5 };
    eyeL = { left: 58, top: 94, width: 26, height: 38, br: 13, rotate: 0 };
    eyeR = { left: 156, top: 98, width: 24, height: 34, br: 12, rotate: 0 };
    mouth = { left: 94, top: 152, width: 54, height: 26, br: 13, rotate: -6 };
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Brow L"
        style={{
          left: `${browL.left}px`,
          top: `${browL.top}px`,
          width: `${browL.width}px`,
          height: `${browL.height}px`,
          transform: `rotate(${browL.rotate}deg)`,
          borderRadius: `${browL.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Brow R"
        style={{
          left: `${browR.left}px`,
          top: `${browR.top}px`,
          width: `${browR.width}px`,
          height: `${browR.height}px`,
          transform: `rotate(${browR.rotate}deg)`,
          borderRadius: `${browR.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-blink-1 4.4s infinite ease-in-out" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-blink-1 4.4s infinite ease-in-out" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transform: `rotate(${mouth.rotate}deg)`,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059]"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={60} top={98} size={28} />
        <DeadEye left={156} top={98} size={28} />
        <DeadMouth left={92} top={152} width={58} height={20} />
      </div>
    </>
  );
}

/* =========================================================================
   2. Teal Blob (250×250) - Бирюзовый лидер
   ========================================================================= */
export function TealFace({ isReacting, variant, hasText = false, talking = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let browL = { left: 63.8, top: 48.4, width: 39.6, height: 11, rotate: -10, br: 5.5 };
  let browR = { left: 143, top: 48.4, width: 39.6, height: 11, rotate: 10, br: 5.5 };
  let eyeL = { left: 74.8, top: 70.4, width: 17.6, height: 26.4, br: 8.8, rotate: 0 };
  let eyeR = { left: 151.8, top: 70.4, width: 17.6, height: 26.4, br: 8.8, rotate: 0 };
  let mouth = { left: 101, top: 98, width: 48, height: 24, br: 12, rotate: 0, scale: hasText && !talking ? 1.08 : 1 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Огромная улыбка
      browL = { left: 66, top: 40, width: 36, height: 9, rotate: -4, br: 4.5 };
      browR = { left: 144, top: 40, width: 36, height: 9, rotate: 4, br: 4.5 };
      eyeL = { left: 72, top: 76, width: 22, height: 12, br: 8, rotate: -4 };
      eyeR = { left: 150, top: 76, width: 22, height: 12, br: 8, rotate: 4 };
      mouth = { left: 92, top: 96, width: 66, height: 38, br: 20, rotate: 0, scale: 1.05 };
    } else if (variant === 2) {
      // 2. Удивление :O
      browL = { left: 62, top: 34, width: 38, height: 9, rotate: 0, br: 4.5 };
      browR = { left: 146, top: 34, width: 38, height: 9, rotate: 0, br: 4.5 };
      eyeL = { left: 72, top: 66, width: 24, height: 24, br: 12, rotate: 0 };
      eyeR = { left: 148, top: 66, width: 24, height: 24, br: 12, rotate: 0 };
      mouth = { left: 112, top: 98, width: 26, height: 38, br: 14, rotate: 0, scale: 1 };
    } else if (variant === 3) {
      // 3. Подмигивание ;)
      browL = { left: 64, top: 52, width: 36, height: 9, rotate: 6, br: 4.5 };
      browR = { left: 144, top: 42, width: 40, height: 10, rotate: 16, br: 5 };
      eyeL = { left: 70, top: 80, width: 24, height: 6, br: 3, rotate: 0 };
      eyeR = { left: 150, top: 68, width: 20, height: 28, br: 10, rotate: 0 };
      mouth = { left: 104, top: 100, width: 46, height: 20, br: 10, rotate: 8, scale: 1 };
    } else {
      // 4. Дзен / довольный прищур
      browL = { left: 64, top: 44, width: 38, height: 9, rotate: -4, br: 4.5 };
      browR = { left: 144, top: 44, width: 38, height: 9, rotate: 4, br: 4.5 };
      eyeL = { left: 72, top: 76, width: 22, height: 8, br: 4, rotate: 0 };
      eyeR = { left: 148, top: 76, width: 22, height: 8, br: 4, rotate: 0 };
      mouth = { left: 106, top: 104, width: 38, height: 16, br: 8, rotate: 0, scale: 1 };
    }
  } else if (hasText && !talking) {
    // Воодушевлённое лицо живого интереса к вводу: брови приподняты, открытая улыбка
    browL = { left: 64, top: 38, width: 38, height: 10, rotate: -4, br: 5 };
    browR = { left: 144, top: 38, width: 38, height: 10, rotate: 4, br: 5 };
    eyeL = { left: 73, top: 67, width: 20, height: 30, br: 10, rotate: 0 };
    eyeR = { left: 150, top: 67, width: 20, height: 30, br: 10, rotate: 0 };
    mouth = { left: 96, top: 95, width: 58, height: 30, br: 15, rotate: 0, scale: 1.05 };
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Brow L"
        style={{
          left: `${browL.left}px`,
          top: `${browL.top}px`,
          width: `${browL.width}px`,
          height: `${browL.height}px`,
          transform: `rotate(${browL.rotate}deg)`,
          borderRadius: `${browL.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Brow R"
        style={{
          left: `${browR.left}px`,
          top: `${browR.top}px`,
          width: `${browR.width}px`,
          height: `${browR.height}px`,
          transform: `rotate(${browR.rotate}deg)`,
          borderRadius: `${browR.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-blink-2 3.9s infinite ease-in-out 0.8s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-blink-2 3.9s infinite ease-in-out 0.8s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      {/* Рот: плавно меняет ширину, высоту и скругление */}
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transform: `rotate(${mouth.rotate}deg) scale(${mouth.scale})`,
          animation: talking && !isReacting ? "blob-talk 0.28s ease-in-out infinite" : undefined,
          transition: t,
        }}
        className="box-border absolute border-4 border-[#00000059] bg-transparent"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={72} top={72} size={26} />
        <DeadEye left={150} top={72} size={26} />
        <DeadMouth left={98} top={98} width={54} height={20} />
      </div>
    </>
  );
}

/* =========================================================================
   3. Green Blob (190×190) - Прищуренный зелёный
   ========================================================================= */
export function GreenFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let eyeL = { left: 40, top: 64, width: 30.4, height: 8.55, br: 4.275, rotate: 0 };
  let eyeR = { left: 120, top: 64, width: 30.4, height: 8.55, br: 4.275, rotate: 0 };
  let mouth = { left: 60.8, top: 114, width: 68.4, height: 9.5, br: 4.75, rotate: -15 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Глаза распахиваются во всю ширину!
      eyeL = { left: 43, top: 56, width: 26, height: 26, br: 13, rotate: 0 };
      eyeR = { left: 121, top: 56, width: 26, height: 26, br: 13, rotate: 0 };
      mouth = { left: 75, top: 114, width: 40, height: 9, br: 4.5, rotate: 0 };
    } else if (variant === 2) {
      // 2. Тёплая улыбка
      eyeL = { left: 40, top: 60, width: 28, height: 12, br: 10, rotate: 0 };
      eyeR = { left: 122, top: 60, width: 28, height: 12, br: 10, rotate: 0 };
      mouth = { left: 66, top: 106, width: 58, height: 26, br: 14, rotate: 0 };
    } else if (variant === 3) {
      // 3. Скептический взгляд
      eyeL = { left: 43, top: 56, width: 24, height: 24, br: 12, rotate: 0 };
      eyeR = { left: 120, top: 66, width: 32, height: 6, br: 3, rotate: 0 };
      mouth = { left: 65, top: 112, width: 60, height: 9, br: 4.5, rotate: 14 };
    } else {
      // 4. Смеющийся прищур
      eyeL = { left: 42, top: 64, width: 26, height: 7, br: 3.5, rotate: 10 };
      eyeR = { left: 122, top: 64, width: 26, height: 7, br: 3.5, rotate: -10 };
      mouth = { left: 70, top: 104, width: 50, height: 28, br: 16, rotate: 0 };
    }
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-squint 5.2s infinite ease-in-out 1.2s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-squint 5.2s infinite ease-in-out 1.2s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transform: `rotate(${mouth.rotate}deg)`,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059]"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={43} top={58} size={24} />
        <DeadEye left={121} top={58} size={24} />
        <DeadMouth left={68} top={110} width={54} height={18} />
      </div>
    </>
  );
}

/* =========================================================================
   4. Purple Blob (270×270) - Фиолетовый гигант
   ========================================================================= */
export function PurpleFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let browL = { left: 75.6, top: 54, width: 43.2, height: 12.15, rotate: -25, br: 6 };
  let browR = { left: 151.2, top: 54, width: 43.2, height: 12.15, rotate: 25, br: 6 };
  let eyeL = { left: 81, top: 81, width: 27, height: 40.5, br: 13.5, rotate: 0 };
  let eyeR = { left: 156.6, top: 81, width: 27, height: 40.5, br: 13.5, rotate: 0 };
  let mouth = { left: 102.6, top: 140.4, width: 64.8, height: 26, br: 13, rotate: 0 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Неожиданная радость!
      browL = { left: 76, top: 46, width: 42, height: 11, rotate: -6, br: 5.5 };
      browR = { left: 150, top: 46, width: 42, height: 11, rotate: 6, br: 5.5 };
      eyeL = { left: 80, top: 88, width: 30, height: 16, br: 12, rotate: -4 };
      eyeR = { left: 156, top: 88, width: 30, height: 16, br: 12, rotate: 4 };
      mouth = { left: 92, top: 134, width: 84, height: 46, br: 24, rotate: 0 };
    } else if (variant === 2) {
      // 2. Сердитый взгляд
      browL = { left: 72, top: 62, width: 48, height: 14, rotate: -36, br: 7 };
      browR = { left: 148, top: 62, width: 48, height: 14, rotate: 36, br: 7 };
      eyeL = { left: 86, top: 90, width: 22, height: 22, br: 11, rotate: 0 };
      eyeR = { left: 160, top: 90, width: 22, height: 22, br: 11, rotate: 0 };
      mouth = { left: 102, top: 146, width: 66, height: 14, br: 7, rotate: 0 };
    } else if (variant === 3) {
      // 3. Челюсть упала :O
      browL = { left: 74, top: 42, width: 44, height: 10, rotate: 0, br: 5 };
      browR = { left: 150, top: 42, width: 44, height: 10, rotate: 0, br: 5 };
      eyeL = { left: 78, top: 76, width: 32, height: 32, br: 16, rotate: 0 };
      eyeR = { left: 154, top: 76, width: 32, height: 32, br: 16, rotate: 0 };
      mouth = { left: 110, top: 130, width: 48, height: 64, br: 24, rotate: 0 };
    } else {
      // 4. Подмигивание
      browL = { left: 74, top: 60, width: 40, height: 10, rotate: 4, br: 5 };
      browR = { left: 152, top: 44, width: 44, height: 12, rotate: 26, br: 6 };
      eyeL = { left: 78, top: 96, width: 30, height: 8, br: 4, rotate: 0 };
      eyeR = { left: 156, top: 80, width: 28, height: 42, br: 14, rotate: 0 };
      mouth = { left: 106, top: 144, width: 56, height: 20, br: 10, rotate: 10 };
    }
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Brow L"
        style={{
          left: `${browL.left}px`,
          top: `${browL.top}px`,
          width: `${browL.width}px`,
          height: `${browL.height}px`,
          transform: `rotate(${browL.rotate}deg)`,
          borderRadius: `${browL.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Brow R"
        style={{
          left: `${browR.left}px`,
          top: `${browR.top}px`,
          width: `${browR.width}px`,
          height: `${browR.height}px`,
          transform: `rotate(${browR.rotate}deg)`,
          borderRadius: `${browR.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-blink-3 5.5s infinite ease-in-out 2.0s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-blink-3 5.5s infinite ease-in-out 2.0s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transform: `rotate(${mouth.rotate}deg)`,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059]"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={78} top={86} size={30} />
        <DeadEye left={156} top={86} size={30} />
        <DeadMouth left={104} top={142} width={64} height={22} />
      </div>
    </>
  );
}

/* =========================================================================
   5. Red Blob (240×240) - Красный задира
   ========================================================================= */
export function RedFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let browL = { left: 52.8, top: hasText ? 68 : 72, width: 48, height: 12, rotate: 18, br: 6 };
  let browR = { left: 139.2, top: hasText ? 82 : 86.4, width: 48, height: 12, rotate: -18, br: 6 };
  let eyeL = { left: 72, top: 96, width: 21.6, height: 21.6, br: 10.8 };
  let eyeR = { left: 144, top: 96, width: 21.6, height: 21.6, br: 10.8 };
  let mouth = { left: 86.4, top: 144, width: 67.2, height: 12, br: 6, rotate: 0 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Улыбка
      browL = { left: 56, top: 68, width: 42, height: 10, rotate: -4, br: 5 };
      browR = { left: 140, top: 68, width: 42, height: 10, rotate: 4, br: 5 };
      eyeL = { left: 70, top: 100, width: 24, height: 12, br: 8 };
      eyeR = { left: 142, top: 100, width: 24, height: 12, br: 8 };
      mouth = { left: 82, top: 138, width: 74, height: 34, br: 18, rotate: 0 };
    } else if (variant === 2) {
      // 2. Округлый шок :O
      browL = { left: 54, top: 56, width: 44, height: 10, rotate: 0, br: 5 };
      browR = { left: 140, top: 56, width: 44, height: 10, rotate: 0, br: 5 };
      eyeL = { left: 68, top: 90, width: 28, height: 28, br: 14 };
      eyeR = { left: 140, top: 90, width: 28, height: 28, br: 14 };
      mouth = { left: 102, top: 138, width: 34, height: 44, br: 17, rotate: 0 };
    } else if (variant === 3) {
      // 3. Подмигивание
      browL = { left: 54, top: 76, width: 40, height: 10, rotate: 8, br: 5 };
      browR = { left: 138, top: 64, width: 44, height: 11, rotate: 18, br: 5.5 };
      eyeL = { left: 68, top: 104, width: 26, height: 6, br: 3 };
      eyeR = { left: 142, top: 94, width: 24, height: 24, br: 12 };
      mouth = { left: 92, top: 142, width: 56, height: 20, br: 10, rotate: 10 };
    } else {
      // 4. Обиженный пухлик
      browL = { left: 56, top: 76, width: 44, height: 11, rotate: 14, br: 5.5 };
      browR = { left: 138, top: 82, width: 44, height: 11, rotate: -14, br: 5.5 };
      eyeL = { left: 72, top: 94, width: 22, height: 22, br: 11 };
      eyeR = { left: 144, top: 94, width: 22, height: 22, br: 11 };
      mouth = { left: 94, top: 148, width: 52, height: 14, br: 7, rotate: 0 };
    }
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Brow L"
        style={{
          left: `${browL.left}px`,
          top: `${browL.top}px`,
          width: `${browL.width}px`,
          height: `${browL.height}px`,
          transform: `rotate(${browL.rotate}deg)`,
          borderRadius: `${browL.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Brow R"
        style={{
          left: `${browR.left}px`,
          top: `${browR.top}px`,
          width: `${browR.width}px`,
          height: `${browR.height}px`,
          transform: `rotate(${browR.rotate}deg)`,
          borderRadius: `${browR.br}px`,
          transition: t,
        }}
        className="box-border origin-top-left absolute bg-[#00000059]"
      />
      <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          animation: !isReacting ? "eye-blink-4 3.7s infinite ease-in-out 0.5s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          animation: !isReacting ? "eye-blink-4 3.7s infinite ease-in-out 0.5s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transform: `rotate(${mouth.rotate}deg)`,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059]"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={66} top={92} size={28} />
        <DeadEye left={142} top={92} size={28} />
        <DeadMouth left={88} top={148} width={60} height={20} />
      </div>
    </>
  );
}

/* =========================================================================
   6. Pink Blob (250×250) - Розовый утончённый
   ========================================================================= */
export function PinkFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let eyeL = { left: 75, top: 75, width: 25, height: 42.5, br: 12.5, rotate: 0 };
  let eyeR = { left: 150, top: 75, width: 25, height: 42.5, br: 12.5, rotate: 0 };
  let mouth = { left: 82.5, top: 155, width: 85, height: 12.5, br: 6.25 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Милая улыбка
      eyeL = { left: 72, top: 88, width: 30, height: 16, br: 12, rotate: -4 };
      eyeR = { left: 148, top: 88, width: 30, height: 16, br: 12, rotate: 4 };
      mouth = { left: 78, top: 148, width: 94, height: 38, br: 20 };
    } else if (variant === 2) {
      // 2. Удивление :O
      eyeL = { left: 72, top: 78, width: 32, height: 32, br: 16, rotate: 0 };
      eyeR = { left: 146, top: 78, width: 32, height: 32, br: 16, rotate: 0 };
      mouth = { left: 110, top: 146, width: 30, height: 40, br: 15 };
    } else if (variant === 3) {
      // 3. Поцелуй / свист :-*
      eyeL = { left: 70, top: 94, width: 30, height: 7, br: 3.5, rotate: 0 };
      eyeR = { left: 150, top: 78, width: 24, height: 38, br: 12, rotate: 0 };
      mouth = { left: 114, top: 152, width: 22, height: 22, br: 11 };
    } else {
      // 4. Смех
      eyeL = { left: 74, top: 90, width: 26, height: 12, br: 8, rotate: -6 };
      eyeR = { left: 150, top: 90, width: 26, height: 12, br: 8, rotate: 6 };
      mouth = { left: 86, top: 150, width: 78, height: 32, br: 16 };
    }
  } else if (hasText) {
    // Тёплая улыбка при вводе
    eyeL = { left: 74, top: 77, width: 27, height: 38, br: 13, rotate: -2 };
    eyeR = { left: 149, top: 77, width: 27, height: 38, br: 13, rotate: 2 };
    mouth = { left: 80, top: 150, width: 90, height: 24, br: 12 };
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-blink-1 4.3s infinite ease-in-out 1.5s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-blink-1 4.3s infinite ease-in-out 1.5s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059]"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={74} top={78} size={28} />
        <DeadEye left={148} top={78} size={28} />
        <DeadMouth left={94} top={148} width={62} height={20} />
      </div>
    </>
  );
}

/* =========================================================================
   7. Yellow Blob (230×230) - Жёлтый оптимист
   ========================================================================= */
export function YellowFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let eyeL = { left: 69, top: 69, width: 23, height: 36.8, br: 11.5, rotate: 0 };
  let eyeR = { left: 138, top: 69, width: 23, height: 36.8, br: 11.5, rotate: 0 };
  let mouthScale = hasText ? 1.06 : 1;
  let mouthRotate = 0;
  let mouthY = 0;

  if (isReacting) {
    if (variant === 1) {
      // 1. Смех XD
      eyeL = { left: 66, top: 82, width: 28, height: 10, br: 6, rotate: -8 };
      eyeR = { left: 136, top: 82, width: 28, height: 10, br: 6, rotate: 8 };
      mouthScale = 1.18;
      mouthY = 4;
    } else if (variant === 2) {
      // 2. Удивление :O
      eyeL = { left: 66, top: 64, width: 30, height: 30, br: 15, rotate: 0 };
      eyeR = { left: 134, top: 64, width: 30, height: 30, br: 15, rotate: 0 };
      mouthScale = 0.85;
      mouthY = 8;
    } else if (variant === 3) {
      // 3. Подмигивание ;)
      eyeL = { left: 64, top: 84, width: 30, height: 6, br: 3, rotate: 0 };
      eyeR = { left: 138, top: 66, width: 24, height: 38, br: 12, rotate: 0 };
      mouthScale = 1.08;
      mouthRotate = 5;
    } else {
      // 4. Тёплая спокойная улыбка
      eyeL = { left: 68, top: 78, width: 24, height: 14, br: 8, rotate: 0 };
      eyeR = { left: 138, top: 78, width: 24, height: 14, br: 8, rotate: 0 };
      mouthScale = 0.95;
      mouthY = -3;
    }
  } else if (hasText) {
    // Радостные щурящиеся глазки ^_^ и широкая открытая улыбка
    eyeL = { left: 66, top: 76, width: 26, height: 14, br: 8, rotate: -6 };
    eyeR = { left: 138, top: 76, width: 26, height: 14, br: 8, rotate: 6 };
    mouthScale = 1.16;
    mouthY = 3;
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-blink-2 3.6s infinite ease-in-out 2.2s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-blink-2 3.6s infinite ease-in-out 2.2s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Smile"
        style={{
          transform: `scale(${mouthScale}) rotate(${mouthRotate}deg) translateY(${mouthY}px)`,
          transition: t,
        }}
        className="box-border w-[101.2px] h-[69px] absolute left-[64.4px] top-[101.2px] bg-[#00000059] [clip-path:path('M0_34.5_C0_53.554_22.654_69_50.6_69_C78.546_69_101.2_53.554_101.2_34.5_L92.092_34.5_C92.092_50.124_73.515_62.79_50.6_62.79_C27.685_62.79_9.108_50.124_9.108_34.5_L0_34.5_Z')] origin-center"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={68} top={72} size={26} />
        <DeadEye left={136} top={72} size={26} />
        <DeadMouth left={90} top={126} width={52} height={18} />
      </div>
    </>
  );
}

/* =========================================================================
   8. Orange Blob (220×220) - Оранжевый удивлённый
   ========================================================================= */
export function OrangeFace({ isReacting, variant, hasText = false, isDead = false }: FaceProps) {
  
  const t = isReacting ? TRANS_REACT : TRANS_RETURN;

  let browY = hasText ? -1.5 : 0;
  let eyeL = { left: 66, top: 70.4, width: 17.6, height: 26.4, br: 8.8, rotate: 0 };
  let eyeR = { left: 136.4, top: 70.4, width: 17.6, height: 26.4, br: 8.8, rotate: 0 };
  let mouth = { left: 96.8, top: 114.4, width: 26.4, height: 30.8, br: 13.2, rotate: 0, scale: hasText ? 1.25 : 1 };

  if (isReacting) {
    if (variant === 1) {
      // 1. Широкая открытая улыбка
      browY = -6;
      eyeL = { left: 64, top: 78, width: 22, height: 12, br: 8, rotate: -4 };
      eyeR = { left: 134, top: 78, width: 22, height: 12, br: 8, rotate: 4 };
      mouth = { left: 78, top: 116, width: 64, height: 32, br: 16, rotate: 0, scale: 1.05 };
    } else if (variant === 2) {
      // 2. Мега-удивление :O
      browY = -12;
      eyeL = { left: 62, top: 66, width: 24, height: 24, br: 12, rotate: 0 };
      eyeR = { left: 134, top: 66, width: 24, height: 24, br: 12, rotate: 0 };
      mouth = { left: 94, top: 110, width: 32, height: 42, br: 16, rotate: 0, scale: 1.1 };
    } else if (variant === 3) {
      // 3. Подмигивание и ухмылка
      browY = -4;
      eyeL = { left: 62, top: 80, width: 24, height: 6, br: 3, rotate: 0 };
      eyeR = { left: 136, top: 68, width: 18, height: 28, br: 9, rotate: 0 };
      mouth = { left: 88, top: 118, width: 44, height: 18, br: 9, rotate: 8, scale: 1 };
    } else {
      // 4. Зевок / сонный
      browY = 0;
      eyeL = { left: 64, top: 76, width: 20, height: 7, br: 3.5, rotate: 0 };
      eyeR = { left: 134, top: 76, width: 20, height: 7, br: 3.5, rotate: 0 };
      mouth = { left: 92, top: 112, width: 36, height: 42, br: 18, rotate: 0, scale: 1 };
    }
  }

  return (
    <>
      {/* Живое лицо: плавное затухание / появление без перемонтирования */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 0 : 1,
          transform: isDead ? "scale(0.65) translateY(6px)" : "scale(1) translateY(0px)",
          transition: isDead ? LIVING_LAYER_TRANS_EXIT : LIVING_LAYER_TRANS_ENTER,
        }}
      >
        <div
        data-pencil-name="Brow L"
        style={{
          transform: `translateY(${browY}px)`,
          transition: t,
        }}
        className="box-border w-[35.2px] h-[22px] absolute left-[57.2px] top-[39.6px] bg-[#00000059] [clip-path:path('M35.2_11_C35.2_4.925_27.32_0_17.6_0_C7.88_0_0_4.925_0_11_L5.28_11_C5.28_6.747_10.796_3.3_17.6_3.3_C24.404_3.3_29.92_6.747_29.92_11_L35.2_11_Z')]"
      />
      <div
        data-pencil-name="Brow R"
        style={{
          transform: `translateY(${browY}px)`,
          transition: t,
        }}
        className="box-border w-[35.2px] h-[22px] absolute left-[127.6px] top-[39.6px] bg-[#00000059] [clip-path:path('M35.2_11_C35.2_4.925_27.32_0_17.6_0_C7.88_0_0_4.925_0_11_L5.28_11_C5.28_6.747_10.796_3.3_17.6_3.3_C24.404_3.3_29.92_6.747_29.92_11_L35.2_11_Z')]"
      />
      <div
        data-pencil-name="Eye L"
        style={{
          left: `${eyeL.left}px`,
          top: `${eyeL.top}px`,
          width: `${eyeL.width}px`,
          height: `${eyeL.height}px`,
          borderRadius: `${eyeL.br}px`,
          transform: `rotate(${eyeL.rotate}deg)`,
          animation: !isReacting ? "eye-blink-3 4.1s infinite ease-in-out 0.7s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Eye R"
        style={{
          left: `${eyeR.left}px`,
          top: `${eyeR.top}px`,
          width: `${eyeR.width}px`,
          height: `${eyeR.height}px`,
          borderRadius: `${eyeR.br}px`,
          transform: `rotate(${eyeR.rotate}deg)`,
          animation: !isReacting ? "eye-blink-3 4.1s infinite ease-in-out 0.7s" : undefined,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      <div
        data-pencil-name="Mouth"
        style={{
          left: `${mouth.left}px`,
          top: `${mouth.top}px`,
          width: `${mouth.width}px`,
          height: `${mouth.height}px`,
          borderRadius: `${mouth.br}px`,
          transform: `rotate(${mouth.rotate}deg) scale(${mouth.scale})`,
          transition: t,
        }}
        className="box-border absolute bg-[#00000059] origin-center"
      />
      </div>

      {/* Мёртвое лицо: плавное появление / исчезновение с мягким отскоком */}
      <div
        className="absolute inset-0 pointer-events-none origin-center"
        style={{
          opacity: isDead ? 1 : 0,
          transform: isDead ? "scale(1) translateY(0px)" : "scale(0.65) translateY(6px)",
          transition: isDead ? DEAD_LAYER_TRANS_ENTER : DEAD_LAYER_TRANS_EXIT,
        }}
      >
        <DeadEye left={62} top={74} size={24} />
        <DeadEye left={132} top={74} size={24} />
        <DeadMouth left={84} top={122} width={50} height={18} />
      </div>
    </>
  );
}
