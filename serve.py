#!/usr/bin/env python3
"""Servidor de desarrollo de Playbook CBP (cbp-v2 con el Taller integrado).

Sirve los archivos estáticos y, para las rutas del Taller (/ejercicios/*),
devuelve /taller/index.html para que su router de History API las resuelva.
El resto (login en /, /app.html, /taller/assets…) se sirve normal.
En producción este papel lo cumple netlify.toml.
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8139
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path.startswith('/ejercicios'):
            self.path = '/taller/index.html'   # fallback SPA del Taller
        elif path.startswith('/equipos') and not path.startswith('/equipos/js') \
                and not path.startswith('/equipos/css'):
            self.path = '/equipos/index.html'  # fallback SPA Equipos/Sesiones
        # el resto de rutas de la SPA Equipos/Sesiones: /sesiones (M2),
        # /partidos (M6) y /dossier (M7). Sin esto, recargar o pegar el
        # enlace de una ficha da 404 (la navegación con pushState sí iba).
        elif path.startswith(('/sesiones', '/partidos', '/dossier', '/inicio', '/perfil', '/admin')):
            self.path = '/equipos/index.html'
        return super().do_GET()

    def do_POST(self):
        """Volcado de artefactos del navegador al disco, SOLO en desarrollo.

        Existe para poder MIRAR lo que la aplicación genera —el PDF de la
        convocatoria, un gif, una captura— en vez de darlo por bueno
        porque no ha dado error. El navegador hace POST a /_dev/volcar
        con {nombre, base64} y el fichero aparece en `.dev-salida/`.

        Nunca sale de aquí: en producción sirve Netlify, que no ejecuta
        este fichero. El nombre se limpia a conciencia de todos modos —un
        volcado que escriba fuera de su carpeta sería un agujero incluso
        en local.
        """
        if self.path.split('?', 1)[0] != '/_dev/volcar':
            self.send_error(404)
            return
        import base64
        import json
        import re
        largo = int(self.headers.get('Content-Length') or 0)
        if largo > 20 * 1024 * 1024:
            self.send_error(413)
            return
        try:
            cuerpo = json.loads(self.rfile.read(largo) or b'{}')
            nombre = re.sub(r'[^A-Za-z0-9._-]', '_', str(cuerpo.get('nombre') or 'volcado.bin'))[:80]
            datos = base64.b64decode(cuerpo.get('base64') or '')
        except Exception as e:
            self.send_error(400, str(e))
            return
        carpeta = os.path.join(ROOT, '.dev-salida')
        os.makedirs(carpeta, exist_ok=True)
        destino = os.path.join(carpeta, nombre)
        with open(destino, 'wb') as f:
            f.write(datos)
        respuesta = json.dumps({'ok': True, 'ruta': destino, 'bytes': len(datos)}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(respuesta)))
        self.end_headers()
        self.wfile.write(respuesta)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'Playbook CBP en http://127.0.0.1:{PORT}')
        httpd.serve_forever()
