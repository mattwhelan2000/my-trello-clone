import * as dotenv from 'dotenv';
dotenv.config();

const COMFYUI_API_URL = process.env.COMFYUI_API_URL || "";

async function generateTest() {
    console.log(`Sending prompt to ComfyUI at: ${COMFYUI_API_URL}`);
    
    // Using the exact logic from initiate-comfyui/index.ts
    const workflow = {
        "9": {
          "inputs": {
            "filename_prefix": "Flux2_dev",
            "images": [
              "98:8",
              0
            ]
          },
          "class_type": "SaveImage"
        },
        "98:22": {
          "inputs": {
            "model": [
              "98:102",
              0
            ],
            "conditioning": [
              "98:26",
              0
            ]
          },
          "class_type": "BasicGuider"
        },
        "98:26": {
          "inputs": {
            "guidance": 4,
            "conditioning": [
              "98:6",
              0
            ]
          },
          "class_type": "FluxGuidance"
        },
        "98:16": {
          "inputs": {
            "sampler_name": "euler"
          },
          "class_type": "KSamplerSelect"
        },
        "98:10": {
          "inputs": {
            "vae_name": "flux2-vae.safetensors"
          },
          "class_type": "VAELoader"
        },
        "98:13": {
          "inputs": {
            "noise": [
              "98:25",
              0
            ],
            "guider": [
              "98:22",
              0
            ],
            "sampler": [
              "98:16",
              0
            ],
            "sigmas": [
              "98:48",
              0
            ],
            "latent_image": [
              "98:47",
              0
            ]
          },
          "class_type": "SamplerCustomAdvanced"
        },
        "98:8": {
          "inputs": {
            "samples": [
              "98:13",
              0
            ],
            "vae": [
              "98:10",
              0
            ]
          },
          "class_type": "VAEDecode"
        },
        "98:38": {
          "inputs": {
            "clip_name": "mistral_3_small_flux2_bf16.safetensors",
            "type": "flux2",
            "device": "default"
          },
          "class_type": "CLIPLoader"
        },
        "98:48": {
          "inputs": {
            "steps": [
              "98:103",
              0
            ],
            "width": 1024,
            "height": 1024
          },
          "class_type": "Flux2Scheduler"
        },
        "98:47": {
          "inputs": {
            "width": 1024,
            "height": 1024,
            "batch_size": 1
          },
          "class_type": "EmptyFlux2LatentImage"
        },
        "98:25": {
          "inputs": {
            "noise_seed": Math.floor(Math.random() * 100000000000000)
          },
          "class_type": "RandomNoise"
        },
        "98:6": {
          "inputs": {
            "text": "test prompt",
            "clip": [
              "98:38",
              0
            ]
          },
          "class_type": "CLIPTextEncode"
        },
        "98:101": {
          "inputs": {
            "lora_name": "flux.2-turbo-lora.safetensors",
            "strength_model": 1,
            "model": [
              "98:12",
              0
            ]
          },
          "class_type": "LoraLoaderModelOnly"
        },
        "98:102": {
          "inputs": {
            "switch": [
              "98:104",
              0
            ],
            "on_false": [
              "98:12",
              0
            ],
            "on_true": [
              "98:101",
              0
            ]
          },
          "class_type": "ComfySwitchNode"
        },
        "98:100": {
          "inputs": {
            "value": 20
          },
          "class_type": "PrimitiveInt"
        },
        "98:99": {
          "inputs": {
            "value": 8
          },
          "class_type": "PrimitiveInt"
        },
        "98:103": {
          "inputs": {
            "switch": [
              "98:104",
              0
            ],
            "on_false": [
              "98:100",
              0
            ],
            "on_true": [
              "98:99",
              0
            ]
          },
          "class_type": "ComfySwitchNode"
        },
        "98:104": {
          "inputs": {
            "value": false
          },
          "class_type": "PrimitiveBoolean"
        },
        "98:12": {
          "inputs": {
            "unet_name": "flux2_dev_fp8mixed.safetensors",
            "weight_dtype": "default"
          },
          "class_type": "UNETLoader"
        }
    };

    try {
        const response = await fetch(`${COMFYUI_API_URL}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: workflow }),
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error("Failed response body:", text);
            return;
        }

        const result = await response.json();
        console.log("Success result:", result);
    } catch (e) {
        console.error("Exception:", e);
    }
}

generateTest();
