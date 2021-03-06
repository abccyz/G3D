import Buffer from "../buffer/buffer";
import GL from "./gl";

interface IProgram {
    fShaderSource: string;
    vShaderSource: string;
}

class Program {

    public glProgram: WebGLProgram;

    private uniforms: {
        [prop: string]: {
            type: string,
            position: number,
            info: WebGLActiveInfo,
            unit: number,
        },
    };
    private attributes: {
        [prop: string]: {
            type: string,
            position: number,
            info: WebGLActiveInfo,
        },
    };

    private textureCount: number = 0;

    private fShaderSource: string;
    private vShaderSource: string;

    constructor({ fShaderSource, vShaderSource }: IProgram) {

        this.fShaderSource = fShaderSource;
        this.vShaderSource = vShaderSource;

        this.initProgram();
    }

    public destructor(): void {

        const { gl } = GL;

        gl.deleteProgram(this.glProgram);
    }

    public uniform(name: string, value: WebGLTexture | Float32Array | Uint32Array | Uint16Array): void {

        if (this.uniforms[name]) {

            const { gl } = GL;

            const { type, info, position, unit } = this.uniforms[name];
            const { baseType, vecType, baseVecType, vecSize } = this.parseType(type);

            switch (baseVecType) {
                case "VEC":
                    {
                        const uniformMethodName = ["uniform", vecSize, baseType === "FLOAT" ? "f" : "i", "v"].join("");
                        gl[uniformMethodName](position, value);
                        break;
                    }
                case "MAT":
                    {
                        const uniformMethodName = ["uniform", "Matrix", vecSize, "fv"].join("");
                        gl[uniformMethodName](position, false, value);
                        break;
                    }
                case "2D":
                    {
                        gl.activeTexture(gl[`TEXTURE${unit}`]);
                        gl.bindTexture(gl.TEXTURE_2D, value);
                        gl.uniform1i(position, unit);
                        break;
                    }
                case "CUB":
                    {
                        gl.activeTexture(gl[`TEXTURE${unit}`]);

                        gl.bindTexture(gl.TEXTURE_CUBE_MAP, value);
                        gl.uniform1i(position, unit);
                        break;
                    }
                default:
                    throw new Error("baseVecType invalid " + baseVecType);
            }

        }
    }

    public attribute(name: string, buffer: WebGLBuffer, stride: number, offset: number): void {
        if (this.attributes[name]) {
            const { gl } = GL;
            const { type, info, position } = this.attributes[name];
            const { baseType, vecType, baseVecType, vecSize } = this.parseType(type);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.vertexAttribPointer(position, vecSize, gl[baseType], false, stride, offset);
            gl.enableVertexAttribArray(position);
        } else {
            // TODO: restore it?
            // console.log(`[Warning] Attribute ${name} not exits.`, this);
        }
    }

    private initProgram(): void {

        const { gl } = GL;

        const fShaderSource = this.fShaderSource;
        const vShaderSource = this.vShaderSource;

        function loadShader(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                throw new Error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
            }
            return shader;
        }

        function getVariableType(value) {
            const types = [
                "FLOAT", "FLOAT_VEC2", "FLOAT_VEC3", "FLOAT_VEC4", "FLOAT_MAT2", "FLOAT_MAT3", "FLOAT_MAT4",
                "INT", "INT_VEC2", "INT_VEC3", "INT_VEC4",
                "BOOL", "BOOL_VEC2", "BOOL_VEC3", "BOOL_VEC4",
                "SAMPLER_2D", "SAMPLER_CUBE",
            ];

            for (let i = 0; i < types.length; i++) {
                if (gl[types[i]] === value) {
                    return types[i];
                }
            }

            throw new Error(`get type failed ' + value`);
        }

        const fShader = loadShader(gl.FRAGMENT_SHADER, fShaderSource);
        const vShader = loadShader(gl.VERTEX_SHADER, vShaderSource);

        const program = gl.createProgram();
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error("Unable to initialize the shader program: " + gl.getProgramInfoLog(program));
        }

        const uniforms = {};
        const attributes = {};

        const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < attributeCount; i++) {

            const attribute = gl.getActiveAttrib(program, i);

            const res = {

                type: getVariableType(attribute.type),

                info: attribute,
                position: gl.getAttribLocation(program, attribute.name),

            };

            attributes[attribute.name] = res;
        }

        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

        for (let i = 0; i < uniformCount; i++) {

            const uniform = gl.getActiveUniform(program, i);

            const res = {
                type: getVariableType(uniform.type),

                info: uniform,
                position: gl.getUniformLocation(program, uniform.name),
                unit: undefined,
            };

            const { baseVecType } = this.parseType(res.type);
            if (baseVecType === "2D") {
                const unit = ++this.textureCount;
                res.unit = unit;
            }
            if (baseVecType === "CUB") {
                const unit = ++this.textureCount;
                res.unit = unit;
            }
            let name = uniform.name;
            if (name.indexOf("[0]") !== -1) {
                name = name.replace("[0]", "");
            }
            uniforms[name] = res;
        }

        this.glProgram = program;
        this.attributes = attributes;
        this.uniforms = uniforms;
    }

    private parseType(type: string) {
        const baseType = type.split("_")[0];
        const vecType = type.split("_").length > 1 ? type.split("_")[1] : "VEC1";
        const baseVecType = vecType.substr(0, 3);
        const vecSize = Number(vecType[3]);
        return { baseType, vecType, baseVecType, vecSize };
    }
}

export default Program;
