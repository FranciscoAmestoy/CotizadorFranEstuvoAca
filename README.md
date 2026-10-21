# Cotizador Interactivo - Fran Estuvo Acá

Cotizador web estático (100% compatible con **GitHub Pages**, sin base de datos ni costos de hosting) diseñado como un **Funnel de 3 pasos a prueba de todo**.

## 🔗 Cómo funcionan los parámetros de la URL

Tu URL base en GitHub Pages será:
`https://franciscoamestoy.github.io/CotizadorFranEstuvoAca/`

Podés habilitar o combinar módulos agregando `?` seguido de los códigos separados por `&`:

| Parámetro | Qué habilita |
| :--- | :--- |
| `v` | Habilita el cotizador de **Videos** (*Grabación+Edición+Publicación* y *Edición+Publicación*, mutuamente excluyentes). |
| `cm` | Habilita los 3 planes mensuales de **Community Management** (*Presencia*, *Crecimiento* y *Total*). |
| `to` | Habilita las opciones de pago único de **Catálogo WhatsApp Business** y **Tienda Online (Tienda Nube / Empretienda)**. |
| `inu` | Muestra la tarjeta de beneficio de **Imprenta Inucorn** (**10% OFF** con el cupón `FRANESTUVOACA`). |
| `c=Nombre` | Personaliza el título de bienvenida y el mensaje de WhatsApp (ej. `c=Conte-GEN`). |
| `nota=Texto` | Muestra un cartel destacado arriba con una nota escrita para ese cliente. |
| `uber=Monto` | (Opcional) Si ponés el valor de 1 viaje de Uber de ida (ej. `uber=4500`), calcula y muestra el costo ida y vuelta (`$9.000`) por visita presencial. Si no lo ponés, dice *"Traslado según zona a coordinar"*. |
| `admin` | Abre directamente la ventana de tu **Panel Generador de Links** (protegido con tu clave). |

### Ejemplos listos para usar:
* **Para Conte-GEN (Videos + CM + Tienda Online):**
  `https://franciscoamestoy.github.io/CotizadorFranEstuvoAca/?v&cm&to&c=Conte-GEN`
* **Con cupón de Imprenta Inucorn incluido:**
  `https://franciscoamestoy.github.io/CotizadorFranEstuvoAca/?v&cm&to&inu&c=Conte-GEN`
* **Solo Videos y Catálogo/Tienda:**
  `https://franciscoamestoy.github.io/CotizadorFranEstuvoAca/?v&to`

---

## ⚙️ Cómo actualizar precios en el futuro ("Set and Forget")
Todos los precios base y textos están centralizados en [`config.js`](./config.js):
* **Video con Grabación (`graboEdiPubli`):** `$50.000` base
* **Video solo Edición (`ediPubli`):** `$35.000` base
* **Planes CM:** Presencia (`$180.000`), Crecimiento (`$280.000`), Total (`$400.000`)
* **Tienda Online / Catálogo WhatsApp:** `$50.000` (pago único c/u)
* **WhatsApp de destino:** `+5493513239815`
