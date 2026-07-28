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
        elif path.startswith(('/sesiones', '/partidos', '/dossier')):
            self.path = '/equipos/index.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'Playbook CBP en http://127.0.0.1:{PORT}')
        httpd.serve_forever()
