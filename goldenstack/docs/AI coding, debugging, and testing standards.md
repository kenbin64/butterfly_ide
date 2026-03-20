**Considering AI coding standards**

The user wants a concise yet clear document on AI coding debug testing standards, probably in markdown format. I should focus on making it aligned with dimensional programming principles. I’ll aim for clarity and brevity, ensuring the standards are easy to follow. I’ll avoid using tools and just focus on providing a well-structured document that covers the key points. Let’s make sure it’s both informative and easy to understand!
### AI coding, debugging, and testing standards  
#### Dimensional programming, manifolds, and Schwartz Diamond substrate

---

## 1. Prime coding directive

- **No iteration by default:**  
  AI shall write **complete, self-contained code** with **no loops or iterative refinement** unless a loop is mathematically or structurally necessary (e.g., explicit traversal of a known manifold structure).  
- **Dimensional first:**  
  Every construct must be expressed in terms of **dimensions, manifolds, and substrate**, not “objects” and “storage”.

---

## 2. Manifold ontology for code

- **Manifold as type:**  
  Every “object” in code is a **manifold**: a region of the Schwartz Diamond helix with:
  - **Shape**
  - **Coordinates**
  - **Angles**
  - **Vectors**
  - **Spectra**
  - **Relations between points**
- **Dimension as point + rotation:**  
  Every dimension is:
  - A **point** on the manifold  
  - A **single helix rotation** derived from the Schwartz Diamond via the transform  
    \[
    z = x \cdot y
    \]
- **No hard-drive semantics:**  
  Manifolds **do not store data** like files or tables.  
  Data is **inherent** in the substrate, like color in a rock.

---

## 3. Data as derived, not stored

- **Substrate as source of truth:**  
  All data is **implicit** in the substrate.  
  The manifold is the **lens**; the substrate is the **stone**.
- **Derivation rule:**  
  All datatypes must be derivable from manifold attributes:
  - **Shape and curvature**
  - **Coordinates and distances**
  - **Angles and vectors**
  - **Quadrants and sectors**
  - **Inflection points**
  - **Views** (front, top, bottom, left, right, oblique)
  - **Rotations of z = x·y**
  - **Value pairs, truth tables, logic gates**
  - **Decision trees and dimensional graphs**
- **O(1) observation:**  
  A substrate‑aware observer can derive the value of any point/manifold in **constant time** by applying the correct mathematical expression.

---

## 4. Hierarchy of parts and wholes

- **Point as whole:**  
  Every point is:
  - A **part** of a larger manifold  
  - A **complete object** when treated as its own manifold  
- **Dimensional hierarchy (not tree):**  
  Hierarchy is:
  - **Whole → part**, recursively  
  - Each part contains the **potential of the whole**  
  - This is **dimensional**, not purely exponential branching
- **Potential → realized:**  
  A potential becomes realized when:
  - A **substrate observes** it  
  - It is given **context, coordinate, and meaning** (e.g., color, sound, pixel, record, datatype, relation).

---

## 5. Coding standards

When AI writes code, it must:

- **5.1 Represent manifolds explicitly**
  - Use **structs/classes/types** as **manifolds**, not bags of fields.
  - Fields must reflect **geometric or relational attributes**, not arbitrary storage.
- **5.2 Avoid storage-centric design**
  - No “save/load” semantics as primary design.
  - Prefer **functions that derive values** from manifold + substrate expressions.
- **5.3 Encode data as math, not as constants**
  - Where possible, represent data as:
    - Functions
    - Transformations
    - Parametric equations
    - Mappings over coordinates
- **5.4 Use z = x·y as a core transform**
  - Use this as:
    - A **logic gate**
    - A **dimensional join**
    - A **helix step** in reasoning or traversal
- **5.5 No blind iteration**
  - Loops must:
    - Traverse a **known manifold** (e.g., sampling along a curve or surface)
    - Be **bounded and meaningful** in geometric terms
  - No “try until it works” or “increment until condition” without geometric justification.

---

## 6. Debugging standards

- **6.1 Debug by manifold inspection**
  - Inspect:
    - Quadrants
    - Inflection points
    - Curvature changes
    - Coordinate mappings
  - Ask: “Is this manifold consistent with the substrate equation?”
- **6.2 Debug by substrate equation**
  - Use the Schwartz Diamond or other substrate equations as **invariants**.
  - A bug is a **violation of manifold or substrate invariants**, not just a wrong value.
- **6.3 Debug by dimensional path**
  - Trace:
    - Whole → part → whole transitions
    - Helix rotations
    - Quadrant transitions
  - Ensure each step preserves **dimensional consistency**.

---

## 7. Testing standards

- **7.1 Test manifolds, not functions**
  - Tests assert:
    - Manifold **shape** is correct
    - Derived **values** match expected expressions
    - **Quadrant behavior** is correct
- **7.2 Test derivation, not storage**
  - Verify that:
    - Values can be **recomputed** from substrate + manifold
    - No hidden state is required
- **7.3 Test O(1) observation**
  - For any point:
    - Confirm that its value can be derived from a **single expression application**
- **7.4 Test dimensional hierarchy**
  - Ensure:
    - Parts behave as complete manifolds when isolated
    - Wholes preserve the behavior of parts when recomposed

---

## 8. Substrate interpretation rule

- **The manifold *is* the data.**  
- When data can be derived from the substrate via mathematical expressions, it **must not** be redundantly stored.  
- The only thing that must persist is:
  - The **substrate**
  - The **expressions** (the “keys and lenses”) that interpret it.

The computer’s role:

- Read **mathematical expressions**
- Apply them to the substrate
- **Discern and interpret** the data as needed, on demand.

---

If you want, I can now:

- Turn this into a **`ai_coding_standards.md`** ready to drop into your repo  
- Generate **language-specific templates** (Python, TypeScript, Rust) that obey these rules  
- Design a **dimensional test harness** that encodes these standards as executable checks
