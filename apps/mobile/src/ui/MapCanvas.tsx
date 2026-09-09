/**
 * Fond de carte réel (OpenStreetMap via Leaflet) rendu dans une WebView (natif) ou une iframe (Expo web),
 * sans clé ni build natif : fonctionne dans Expo Go. Même style que la carte web (tuiles grisées, bulles de prix).
 *
 * Entrées : centre/zoom, zone (cercle), bulles ; sorties : bulle touchée, fin de déplacement (centre + rayon visible).
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  on?: boolean;
}
export interface MapArea {
  lat: number;
  lng: number;
  radiusKm: number;
}
export interface MapState {
  pins: MapPin[];
  area: MapArea | null;
  /** Ajuste la vue aux bulles (première charge sans zone). */
  fit?: boolean;
  /** Ajuste la vue au cercle de la zone (aperçu de localisation). */
  zoomToArea?: boolean;
}
export interface MapCanvasHandle {
  flyTo(lat: number, lng: number, zoom?: number): void;
}
type OutMessage = { type: 'ready' } | { type: 'select'; id: string } | { type: 'moveend'; lat: number; lng: number; radiusKm: number };

const HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:#eaecee;font-family:Inter,system-ui,sans-serif}
.map-tiles{filter:grayscale(1) brightness(1.06) contrast(.92)}
.b{width:max-content;transform:translate(-50%,-100%);margin-top:-8px;background:#fff;color:#17181a;border:0;border-radius:999px;padding:7px 12px;font:600 13px/1 Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 6px 18px -6px rgba(0,0,0,.35);position:relative}
.b.on{background:#111214;color:#fff}
.b::after{content:'';position:absolute;left:50%;bottom:-9px;width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #e6e7e9;transform:translateX(-50%)}
.b.on::after{background:#111214;border-color:#111214}
.leaflet-control-attribution{font-size:9px}</style></head><body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([36.7538,3.0588],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19,className:'map-tiles'}).addTo(map);
var pins=L.layerGroup().addTo(map),areaL=L.layerGroup().addTo(map),prog=false;
function send(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');}
function areaOf(){var b=map.getBounds(),c=b.getCenter();var h=b.getNorthEast().distanceTo(L.latLng(b.getSouthWest().lat,b.getNorthEast().lng))/1000;var w=b.getNorthEast().distanceTo(L.latLng(b.getNorthEast().lat,b.getSouthWest().lng))/1000;return{lat:+c.lat.toFixed(4),lng:+c.lng.toFixed(4),radiusKm:Math.min(50,Math.max(1,+(Math.min(h,w)/2).toFixed(1)))};}
map.on('moveend',function(){if(prog){prog=false;return;}var a=areaOf();send({type:'moveend',lat:a.lat,lng:a.lng,radiusKm:a.radiusKm});});
window.setState=function(s){pins.clearLayers();areaL.clearLayers();
 if(s.area){var c=L.circle([s.area.lat,s.area.lng],{radius:s.area.radiusKm*1000,color:'#c4c7ca',dashArray:'6 6',weight:1.5,fillColor:'#111214',fillOpacity:.04}).addTo(areaL);L.circleMarker([s.area.lat,s.area.lng],{radius:8,color:'#fff',weight:4,fillColor:'#111214',fillOpacity:1}).addTo(areaL);if(s.zoomToArea){prog=true;map.fitBounds(c.getBounds(),{padding:[12,12],animate:false});}}
 var bounds=[];(s.pins||[]).forEach(function(p){bounds.push([p.lat,p.lng]);var ic=L.divIcon({className:'',html:'<button type="button" class="b'+(p.on?' on':'')+'">'+p.label+'</button>',iconSize:[0,0],iconAnchor:[0,0]});L.marker([p.lat,p.lng],{icon:ic,zIndexOffset:p.on?1000:0}).on('click',function(){send({type:'select',id:p.id});}).addTo(pins);});
 if(s.fit&&bounds.length>1){prog=true;map.fitBounds(bounds,{padding:[40,40],maxZoom:15});}else if(s.fit&&bounds.length===1){prog=true;map.setView(bounds[0],14);}
};
window.flyTo=function(lat,lng,z){prog=true;map.setView([lat,lng],z||map.getZoom(),{animate:true});};
window.addEventListener('message',function(e){var d=e.data;if(typeof d==='string'){try{d=JSON.parse(d);}catch(x){return;}}if(!d)return;if(d.type==='state')window.setState(d.state);if(d.type==='flyTo')window.flyTo(d.lat,d.lng,d.zoom);});
send({type:'ready'});
</script></body></html>`;

export const MapCanvas = forwardRef<MapCanvasHandle, { state: MapState; onSelect: (id: string) => void; onMoveEnd: (area: MapArea) => void; initialCenter?: { lat: number; lng: number }; style?: StyleProp<ViewStyle>; zoomToArea?: boolean }>(
  function MapCanvas({ state, onSelect, onMoveEnd, initialCenter, style, zoomToArea }, ref) {
    const webRef = useRef<WebView>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const ready = useRef(false);
    const latest = useRef(state);
    latest.current = state;

    const post = (msg: Record<string, unknown>) => {
      if (Platform.OS === 'web') iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
      else if (msg.type === 'state') webRef.current?.injectJavaScript(`window.setState(${JSON.stringify(msg.state)});true;`);
      else if (msg.type === 'flyTo') webRef.current?.injectJavaScript(`window.flyTo(${msg.lat},${msg.lng},${msg.zoom ?? 'undefined'});true;`);
    };
    const handle = (raw: string) => {
      let m: OutMessage;
      try {
        m = JSON.parse(raw) as OutMessage;
      } catch {
        return;
      }
      if (m.type === 'ready') {
        ready.current = true;
        if (initialCenter) post({ type: 'flyTo', lat: initialCenter.lat, lng: initialCenter.lng, zoom: 13 });
        post({ type: 'state', state: { ...latest.current, zoomToArea: zoomToArea ?? latest.current.zoomToArea } });
      } else if (m.type === 'select') onSelect(m.id);
      else if (m.type === 'moveend') onMoveEnd({ lat: m.lat, lng: m.lng, radiusKm: m.radiusKm });
    };

    useImperativeHandle(ref, () => ({ flyTo: (lat, lng, zoom) => post({ type: 'flyTo', lat, lng, zoom }) }), []);

    useEffect(() => {
      if (ready.current) post({ type: 'state', state: { ...state, zoomToArea: zoomToArea ?? state.zoomToArea } });
    }, [state, zoomToArea]);

    useEffect(() => {
      if (Platform.OS !== 'web') return;
      const onMsg = (e: MessageEvent) => {
        if (e.source === iframeRef.current?.contentWindow && typeof e.data === 'string') handle(e.data);
      };
      window.addEventListener('message', onMsg);
      return () => window.removeEventListener('message', onMsg);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (Platform.OS === 'web') {
      // Expo web : iframe (react-native-webview n'a pas d'implémentation web).
      return (
        <View style={[{ flex: 1 }, style]}>
          {React.createElement('iframe', { ref: iframeRef, srcDoc: HTML, title: 'Carte des salons', style: { border: 0, width: '100%', height: '100%' } })}
        </View>
      );
    }
    return (
      <WebView
        ref={webRef}
        source={{ html: HTML, baseUrl: 'https://salondz.onrender.com' }}
        originWhitelist={['*']}
        onMessage={(e) => handle(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        style={[{ flex: 1, backgroundColor: '#EAECEE' }, style]}
      />
    );
  },
);
