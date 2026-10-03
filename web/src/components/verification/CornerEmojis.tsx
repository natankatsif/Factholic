import React from "react";

/**
 * Три смайлика в правом нижнем углу плашки «Позиции источников» (как в макете).
 * Разметка лиц — из home/EmojiCrowd.tsx; у каждого свой диаметр и положение от угла карточки.
 */
export function CornerEmojis() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden min-[1440px]:block">
      <div className="absolute" style={{ width: 125, height: 125, right: -15, bottom: -22 }}>
        <div className="origin-top-left" style={{ transform: `scale(${125 / 270})` }}>
          <div
            data-pencil-name="Purple Blob"
            className="box-border w-[270px] h-[270px] absolute left-0 top-0 bg-[#6E1EF0] rounded-[135px] [z-index:3]"
          >
            <div
              data-pencil-name="Brow L"
              className="box-border w-[43.2px] h-[12.15px] [transform:rotate(-25deg)] [transform-origin:top_left] absolute left-[75.6px] top-[54px] bg-[#00000059] rounded-[6.075px] [z-index:0]"
            ></div>
            <div
              data-pencil-name="Brow R"
              className="box-border w-[43.2px] h-[12.15px] [transform:rotate(25deg)] [transform-origin:top_left] absolute left-[151.2px] top-[54px] bg-[#00000059] rounded-[6.075px] [z-index:1]"
            ></div>
            <div
              data-pencil-name="Eye L"
              className="box-border w-[27px] h-[40.5px] absolute left-[81px] top-[81px] bg-[#00000059] rounded-full [z-index:2]"
            ></div>
            <div
              data-pencil-name="Eye R"
              className="box-border w-[27px] h-[40.5px] absolute left-[156.6px] top-[81px] bg-[#00000059] rounded-full [z-index:3]"
            ></div>
            <div
              data-pencil-name="Mouth"
              className="box-border w-[64.8px] h-[43.2px] absolute left-[102.6px] top-[140.4px] bg-[#00000059] [clip-path:path('M64.8_21.6_C64.8_9.671_50.294_0_32.4_0_C14.506_0_0_9.671_0_21.6_L7.128_21.6_C7.128_12.295_18.443_4.752_32.4_4.752_C46.357_4.752_57.672_12.295_57.672_21.6_L64.8_21.6_Z')] [z-index:4]"
            ></div>
          </div>
        </div>
      </div>
      <div className="absolute" style={{ width: 96, height: 96, right: 180, bottom: -10 }}>
        <div className="origin-top-left" style={{ transform: `scale(${96 / 230})` }}>
          <div
            data-pencil-name="Yellow Blob"
            className="box-border w-[230px] h-[230px] absolute left-0 top-0 bg-[#FFC20E] rounded-[115px] [z-index:6]"
          >
            <div
              data-pencil-name="Eye L"
              className="box-border w-[23px] h-[36.8px] absolute left-[69px] top-[69px] bg-[#00000059] rounded-full [z-index:0]"
            ></div>
            <div
              data-pencil-name="Eye R"
              className="box-border w-[23px] h-[36.8px] absolute left-[138px] top-[69px] bg-[#00000059] rounded-full [z-index:1]"
            ></div>
            <div
              data-pencil-name="Smile"
              className="box-border w-[101.2px] h-[69px] absolute left-[64.4px] top-[101.2px] bg-[#00000059] [clip-path:path('M0_34.5_C0_53.554_22.654_69_50.6_69_C78.546_69_101.2_53.554_101.2_34.5_L92.092_34.5_C92.092_50.124_73.515_62.79_50.6_62.79_C27.685_62.79_9.108_50.124_9.108_34.5_L0_34.5_Z')] [z-index:2]"
            ></div>
          </div>
        </div>
      </div>
      <div className="absolute" style={{ width: 115, height: 115, right: 85, bottom: -13 }}>
        <div className="origin-top-left" style={{ transform: `scale(${115 / 220})` }}>
          <div
            data-pencil-name="Orange Blob"
            className="box-border w-[220px] h-[220px] absolute left-0 top-0 bg-[#FF7A12] rounded-[110px] [z-index:7]"
          >
            <div
              data-pencil-name="Brow L"
              className="box-border w-[35.2px] h-[22px] absolute left-[57.2px] top-[39.6px] bg-[#00000059] [clip-path:path('M35.2_11_C35.2_4.925_27.32_0_17.6_0_C7.88_0_0_4.925_0_11_L5.28_11_C5.28_6.747_10.796_3.3_17.6_3.3_C24.404_3.3_29.92_6.747_29.92_11_L35.2_11_Z')] [z-index:0]"
            ></div>
            <div
              data-pencil-name="Brow R"
              className="box-border w-[35.2px] h-[22px] absolute left-[127.6px] top-[39.6px] bg-[#00000059] [clip-path:path('M35.2_11_C35.2_4.925_27.32_0_17.6_0_C7.88_0_0_4.925_0_11_L5.28_11_C5.28_6.747_10.796_3.3_17.6_3.3_C24.404_3.3_29.92_6.747_29.92_11_L35.2_11_Z')] [z-index:1]"
            ></div>
            <div
              data-pencil-name="Eye L"
              className="box-border w-[17.6px] h-[26.4px] absolute left-[66px] top-[70.4px] bg-[#00000059] rounded-full [z-index:2]"
            ></div>
            <div
              data-pencil-name="Eye R"
              className="box-border w-[17.6px] h-[26.4px] absolute left-[136.4px] top-[70.4px] bg-[#00000059] rounded-full [z-index:3]"
            ></div>
            <div
              data-pencil-name="Mouth"
              className="box-border w-[26.4px] h-[30.8px] absolute left-[96.8px] top-[114.4px] bg-[#00000059] rounded-full [z-index:4]"
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
