function n(r,i=0){const e=r?.spec?.id;return Number.isInteger(e)&&e>=0&&e<15?e:i}function a(r,i,e){r.onBeforeCompile=o=>{o.uniforms.bikeColorMap={value:i},o.uniforms.bikeColorMask={value:e},o.fragmentShader=`uniform sampler2D bikeColorMap;
uniform sampler2D bikeColorMask;
`+o.fragmentShader,o.fragmentShader=o.fragmentShader.replace("#include <map_fragment>",`
      #include <map_fragment>
      #ifdef USE_MAP
        float bikePaint = texture2D(bikeColorMask, vMapUv).r;
        vec3 bikeColor = texture2D(bikeColorMap, vMapUv).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * bikeColor, bikePaint);
      #endif
    `)},r.customProgramCacheKey=()=>"native-bike-colors-v1"}export{a as applyBikeColors,n as bikePaletteIndex};
