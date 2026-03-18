# Guía para Colaboradores

Gracias por querer colaborar en Isytask + Isysocial. Esta guía explica cómo trabajar de forma segura y organizada.

## 📋 Antes de Empezar

### Requisitos
- Git configurado con SSH
- Node.js ≥ 20.0.0
- pnpm 9.10.0+
- Acceso de GitHub al repo (como "Maintain")

### Setup Inicial

```bash
# 1. Clonar el repo
git clone https://github.com/rob681/isytask-isysocial.git
cd isytask-isysocial

# 2. Instalar dependencias
pnpm install

# 3. Copiar .env files (pide a Rob)
# Necesitas:
# - isytask/.env
# - isysocial/.env
```

## 🌿 Workflow de Branches

### Nombres de Branches
```
feature/nombre-de-la-feature    # Nueva feature
bugfix/nombre-del-bug           # Bug fix
refactor/nombre-del-refactor    # Refactoring
docs/nombre-de-docs             # Documentación
```

### Ejemplo: Agregar Feature

```bash
# 1. Crear rama basada en main
git checkout main
git pull origin main
git checkout -b feature/agregar-dashboard-nuevo

# 2. Hacer cambios
# ... edita archivos ...

# 3. Commit (ver "Mensajes de Commit" abajo)
git add .
git commit -m "feat: add new admin dashboard with analytics"

# 4. Push a GitHub
git push -u origin feature/agregar-dashboard-nuevo

# 5. En GitHub: Abre un PR (Pull Request)
# GitHub te pedirá crear PR con un template
```

## 📝 Mensajes de Commit

Usa el formato **Conventional Commits**:

```
<tipo>: <descripción corta>

<descripción detallada opcional>
```

### Tipos
- **feat:** Nueva feature
- **fix:** Bug fix
- **refactor:** Código sin cambiar comportamiento
- **docs:** Documentación
- **style:** Cambios de formato/espacios (no afecta lógica)
- **test:** Agregar/actualizar tests
- **perf:** Mejoras de performance

### Ejemplos

```
feat: add multi-assignment to tasks

- Permite asignar múltiples colaboradores a una tarea
- Agrega modal de selección
- Actualiza DB schema con TaskAssignment
```

```
fix: prevent duplicate Prisma files in build

- Clean up generated/ folder before build
- Add to .gitignore
```

## 🔄 Pull Request (PR) Workflow

### Crear PR

1. **Push tu rama** (como en ejemplo arriba)
2. **En GitHub:** Click en "Create Pull Request"
3. **Completa el template:**
   ```markdown
   ## Descripción
   Qué cambios hiciste y por qué

   ## Type of Change
   - [ ] Nueva feature
   - [ ] Bug fix
   - [ ] Breaking change
   - [ ] Doc update

   ## Testing Done
   Cómo testeaste los cambios

   ## Checklist
   - [ ] Código está formateado
   - [ ] Tests pasan
   - [ ] No hay console.logs de debug
   - [ ] .env no fue commiteado
   ```

### Esperar Review

1. **Vercel Preview automático** creado al abrir PR
   - URL: `https://isytask-pr-123.vercel.app`
   - Usa esto para testear en vivo
2. **Rob revisa** el código y el preview
3. **Feedback:** Si hay cambios, los discutimos en la PR
4. **Aprobación:** "Looks good" significa ✅

### Merge a Main

Una vez aprobado:
1. Click en "Squash and merge" (preferido para PRs pequeñas)
2. O "Rebase and merge" para feature branches grandes
3. Vercel **automáticamente deploya a producción** 🚀

## 🔐 Cosas Importantes

### ❌ NUNCA Commitear

```
.env             # Variables de entorno (secrets)
.env.local       # Local config
.next/           # Next.js build output
node_modules/    # Dependencias
dist/            # Build artifacts
generated/       # Archivos generados
.vercel/         # Vercel CLI config
```

El `.gitignore` ya los excluye, pero asegúrate de no forzarlos con `git add -f`.

### ✅ SIEMPRE Checkear Antes de PR

```bash
# 1. Build local (detecta errors temprano)
pnpm build

# 2. Linting
pnpm lint

# 3. Tests
pnpm test

# 4. Verifica que el .env no está en el commit
git status
```

## 🧪 Testing

### Tests Locales

```bash
# Correr todos los tests
pnpm test

# Watch mode (re-run en cambios)
pnpm test:watch

# Solo un archivo
pnpm test -- specific-test.test.ts
```

### Testing Manual

```bash
# Dev mode (Isytask)
cd isytask/apps/web
pnpm dev
# http://localhost:3000

# Dev mode (Isysocial)
cd isysocial/apps/web
pnpm dev
# http://localhost:3001
```

## 🚀 Vercel Preview

Cada PR automáticamente genera un **preview deployment**:

1. **Al abrir PR:** Vercel comienza a buildear
2. **Link en PR:** "Visit Preview" → `https://isytask-pr-123.vercel.app`
3. **Usa para testear:** Haz click en el link y verifica los cambios
4. **Feedback:** Comparte si ves issues

**Nota:** Previews tienen datos de desarrollo (no producción). Si necesitas acceso a datos específicos, pide a Rob.

## 📂 Estructura de Directorios (Quick Reference)

```
isytask/
├── apps/web/              # Next.js app
│   ├── app/               # App Router (pages)
│   ├── components/        # React components
│   ├── lib/               # Utilities
│   └── public/            # Static files
├── packages/
│   ├── api/               # tRPC routers
│   ├── db/                # Prisma schema
│   └── shared/            # Types, constants
└── package.json

isysocial/
└── [Estructura idéntica a isytask]
```

## 🆘 Troubleshooting

### "Dependencies not installed"
```bash
pnpm install
```

### "Build fails locally"
```bash
# Clean build
rm -rf isytask/.next isysocial/.next
pnpm build
```

### ".env not found"
```bash
# Pide a Rob (contiene secrets)
# Copia las files que te envíe a la raíz de cada proyecto
```

### "Git says .env was modified"
```bash
# Nunca fue staged, pero Git lo ve como changed:
git restore .env
```

### "Vercel Preview failed"
- Verifica los logs en Vercel dashboard
- Posibles causas: env var faltante, build error, error en deploy
- Abre un issue o contacta a Rob

## 💬 Comunicación

- **Questions sobre setup?** → Abre un GitHub Issue
- **Questions sobre features?** → Comenta en la PR
- **Urgent issues?** → Contacta a Rob directamente

## 📚 Recursos Adicionales

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [tRPC Docs](https://trpc.io/)
- [Tailwind CSS Docs](https://tailwindcss.com/)

## 🎯 Resumen Rápido del Flujo

```
1. git clone https://github.com/rob681/isytask-isysocial.git
2. git checkout -b feature/mi-feature
3. Edita archivos
4. pnpm build && pnpm lint (verifica localmente)
5. git commit -m "feat: descripción"
6. git push -u origin feature/mi-feature
7. En GitHub: Abre PR
8. Espera a que Vercel cree preview
9. Rob revisa código + preview
10. Merge → Deploy automático a producción ✅
```

---

**¡Gracias por contribuir!** 🙌
