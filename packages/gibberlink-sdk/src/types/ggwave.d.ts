declare module 'ggwave' {
  export interface GGWaveParameters {
    // Add any specific parameters here if known
    sampleRateInp?: number;
    sampleRateOut?: number;
    soundMarkerThreshold?: number;
    [key: string]: any;
  }

  export interface GGWaveInstance {
    // Add any specific instance properties here if known
    [key: string]: any;
  }

  export interface GGWaveModule {
    getDefaultParameters(): GGWaveParameters;
    init(params: GGWaveParameters): GGWaveInstance;
    encode(instance: GGWaveInstance, message: string, protocol: number, volume: number): Int16Array;
    decode(instance: GGWaveInstance, samples: Int16Array): Uint8Array | null;
    ProtocolId: {
      GGWAVE_PROTOCOL_AUDIBLE_NORMAL: number;
      GGWAVE_PROTOCOL_AUDIBLE_FAST: number;
      GGWAVE_PROTOCOL_AUDIBLE_FASTEST: number;
      [key: string]: number;
    };
  }

  export default function(): Promise<GGWaveModule>;
} 