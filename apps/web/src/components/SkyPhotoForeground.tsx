import { useEffect, useRef, useState } from 'react'

type Props = {
  source: string
  heading: number
  pitch: number
  fov: number
  centerBearing: number
  horizonShift: number
  onError: (message: string) => void
}

// A perspective projector renders the equirectangular foreground on the
// exact same pinhole camera geometry as skyImmersiveData.projectObserverStar.
// Crucially, original sky pixels have transparent alpha in this texture.
// The stars from Skyfield/Hipparcos remain behind trees and buildings.
const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`
const FRAGMENT = `
precision highp float;
uniform sampler2D u_photo;
uniform float u_heading;
uniform float u_pitch;
uniform float u_fov;
uniform float u_center;
uniform float u_horizon;
uniform vec2 u_resolution;

const float PI = 3.141592653589793;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float tanHalf = tan(radians(u_fov) * .5);
  float right = (uv.x * 2.0 - 1.0) * tanHalf;
  float up = (uv.y * 2.0 - 1.0) * tanHalf * .6;
  float p = radians(u_pitch);
  float forward = cos(p) - up * sin(p);
  float vertical = sin(p) + up * cos(p);
  float az = mod(u_heading + degrees(atan(right, forward)) + 360.0, 360.0);
  float alt = degrees(atan(vertical, length(vec2(right, forward))));
  float sampleU = fract(.5 + (az - u_center) / 360.0);
  // Image y=0 is the top; JS uploads with UNPACK_FLIP_Y_WEBGL.
  float sampleV = .5 - alt / 180.0 + u_horizon;
  // Avoid wrapping into unrelated ground at the poles.
  if (sampleV < 0.0 || sampleV > 1.0) {
    gl_FragColor = vec4(0.0);
  } else {
    vec4 foreground = texture2D(u_photo, vec2(sampleU, sampleV));
    gl_FragColor = foreground;
  }
}
`

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const obj = gl.createShader(type)
  if (!obj) throw new Error('Cannot create WebGL shader')
  gl.shaderSource(obj, source)
  gl.compileShader(obj)
  if (!gl.getShaderParameter(obj, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(obj) ?? 'Unknown shader error'
    gl.deleteShader(obj)
    throw new Error(error)
  }
  return obj
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!program) throw new Error('Cannot create WebGL program')
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'WebGL link error')
  }
  return program
}

export function SkyPhotoForeground({ source, heading, pitch, fov, centerBearing, horizonShift, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)
  const context = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    let cancelled = false
    let texture: WebGLTexture | null = null
    let vertexBuffer: WebGLBuffer | null = null
    let gl: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    setReady(false)

    const start = async () => {
      try {
        const image = new Image()
        image.decoding = 'async'
        image.src = source
        await image.decode()
        if (cancelled) return
        if (image.width !== image.height * 2) {
          throw new Error('The foreground must be a 2:1 equirectangular PNG or WebP.')
        }

        gl = element.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false })
        if (!gl) throw new Error('This browser does not support WebGL panoramic rendering.')
        program = createProgram(gl)
        context.current = gl
        programRef.current = program
        gl.useProgram(program)
        vertexBuffer = gl.createBuffer()
        if (!vertexBuffer) throw new Error('Could not allocate panorama geometry.')
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW)
        const position = gl.getAttribLocation(program, 'a_pos')
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

        texture = gl.createTexture()
        if (!texture) throw new Error('Cannot allocate panoramic texture.')
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        // Works with non-power-of-two image sizes in WebGL 1.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.uniform1i(gl.getUniformLocation(program, 'u_photo'), 0)
        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : 'Unable to load panoramic foreground.')
      }
    }
    void start()
    return () => {
      cancelled = true
      setReady(false)
      context.current = null
      programRef.current = null
      if (gl && texture) gl.deleteTexture(texture)
      if (gl && vertexBuffer) gl.deleteBuffer(vertexBuffer)
      if (gl && program) gl.deleteProgram(program)
    }
  // 'onError' is a UI callback; reinitialize only on the actual panorama URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    if (!ready || !canvas.current || !context.current || !programRef.current) return
    const gl = context.current
    const program = programRef.current
    const element = canvas.current
    // Keep the exact 1000x600 projection as the Hipparcos star SVG.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const width = Math.round(element.clientWidth * dpr)
    const height = Math.round(element.clientHeight * dpr)
    if (width <= 0 || height <= 0) return
    if (element.width !== width || element.height !== height) {
      element.width = width
      element.height = height
    }
    gl.viewport(0, 0, width, height)
    gl.useProgram(program)
    gl.uniform1f(gl.getUniformLocation(program, 'u_heading'), heading)
    gl.uniform1f(gl.getUniformLocation(program, 'u_pitch'), pitch)
    gl.uniform1f(gl.getUniformLocation(program, 'u_fov'), fov)
    gl.uniform1f(gl.getUniformLocation(program, 'u_center'), centerBearing)
    gl.uniform1f(gl.getUniformLocation(program, 'u_horizon'), horizonShift)
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }, [ready, heading, pitch, fov, centerBearing, horizonShift])

  return <canvas ref={canvas} className="immersive-photo-foreground"
    aria-hidden="true" style={{ opacity: ready ? 1 : 0 }}/>
}
