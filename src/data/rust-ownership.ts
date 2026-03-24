import type { SampleConversation } from "../types";

export const rustOwnership: SampleConversation = {
  id: "rust-ownership",
  title: "Rust Ownership & Borrowing",
  description: "Understanding why Rust code won't compile and how to fix it",
  category: "code",
  messages: [
    {
      role: "user",
      segments: [
        {
          type: "text",
          content: `I'm trying to learn Rust and I keep running into ownership errors. This code won't compile and I don't understand why:

\`\`\`rust
fn main() {
    let names = vec!["Alice".to_string(), "Bob".to_string(), "Charlie".to_string()];

    let greeting = build_greeting(names);
    println!("{}", greeting);

    // This line causes the error
    println!("We had {} people", names.len());
}

fn build_greeting(names: Vec<String>) -> String {
    let mut parts = Vec::new();
    for name in &names {
        parts.push(format!("Hello, {}!", name));
    }
    parts.join("\\n")
}
\`\`\`

The error says "borrow of moved value: \`names\`". What does that mean?`,
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `This is one of the most fundamental concepts in Rust, and once it clicks, a lot of the language starts making sense. Let me explain what's happening.

**Ownership in Rust**

Every value in Rust has exactly one *owner* — a variable that is responsible for that value. When the owner goes out of scope, the value is dropped (freed). This is how Rust manages memory without a garbage collector.

The critical rule is: **when you pass a value to a function, ownership moves to that function.** This is called a *move*.

In your code:

\`\`\`rust
let names = vec![...];           // 'names' owns the Vec
let greeting = build_greeting(names);  // ownership MOVES to build_greeting
println!("... {}", names.len());       // ERROR: 'names' no longer owns anything
\`\`\`

After calling \`build_greeting(names)\`, the variable \`names\` in \`main\` is no longer valid. The Vec has been moved into the function. Rust prevents you from using it because the data might have been freed when \`build_greeting\` finished.

**Why Does Rust Do This?**

Consider what would happen without this rule. If both \`main\` and \`build_greeting\` had access to the same Vec, and \`build_greeting\` decided to drop it or modify it, \`main\` would be left with a dangling pointer — a reference to freed memory. This is a whole category of bugs (use-after-free) that Rust eliminates at compile time.

**Three Ways to Fix It**

**Option 1: Borrow instead of move (best for this case)**

Instead of taking ownership, \`build_greeting\` can *borrow* the Vec by taking a reference:

\`\`\`rust
fn build_greeting(names: &Vec<String>) -> String {
    // or better: fn build_greeting(names: &[String]) -> String
    let mut parts = Vec::new();
    for name in names {
        parts.push(format!("Hello, {}!", name));
    }
    parts.join("\\n")
}
\`\`\`

Now call it with \`build_greeting(&names)\`. The \`&\` means "I'm lending you access, but I keep ownership." After the function returns, \`names\` is still valid in \`main\`.

A better Rust convention is to accept \`&[String]\` (a slice) instead of \`&Vec<String>\`. Slices are more general — they work with arrays, vectors, and subranges. This is similar to how in Go you'd accept a slice rather than a pointer to a slice.

**Option 2: Clone the data**

\`\`\`rust
let greeting = build_greeting(names.clone());
\`\`\`

This creates a deep copy of the Vec and its strings, so the original \`names\` is unaffected. This works but is wasteful — you're allocating new memory for no reason when all you need is read access.

**Option 3: Return ownership back**

\`\`\`rust
fn build_greeting(names: Vec<String>) -> (String, Vec<String>) {
    // ... build the greeting ...
    (result, names)  // return the Vec back
}

let (greeting, names) = build_greeting(names);
\`\`\`

This is awkward and not idiomatic. Borrowing is the right solution here.

**The Borrowing Rules**

When you borrow (take a reference), Rust enforces two rules at compile time:

1. You can have **either** one mutable reference (\`&mut T\`) **or** any number of immutable references (\`&T\`) — but not both at the same time.
2. References must always be valid (no dangling references).

This prevents data races at compile time. If something has a \`&mut\` reference, nothing else can read or write to it. If things have \`&\` references, the data is guaranteed not to change.

Here's the fixed version of your full program:

\`\`\`rust
fn main() {
    let names = vec!["Alice".to_string(), "Bob".to_string(), "Charlie".to_string()];

    let greeting = build_greeting(&names);  // borrow with &
    println!("{}", greeting);

    println!("We had {} people", names.len());  // works fine now
}

fn build_greeting(names: &[String]) -> String {
    let mut parts = Vec::new();
    for name in names {
        parts.push(format!("Hello, {}!", name));
    }
    parts.join("\\n")
}
\`\`\``,
        },
      ],
    },
    {
      role: "user",
      segments: [
        {
          type: "text",
          content: `OK that makes sense. But now I'm hitting another issue. I want to modify the names in a function:

\`\`\`rust
fn main() {
    let names = vec!["Alice".to_string(), "Bob".to_string()];
    add_name(&names, "Charlie".to_string());
    println!("{:?}", names);
}

fn add_name(names: &Vec<String>, name: String) {
    names.push(name);
}
\`\`\`

It says "cannot borrow as mutable". How do I fix this?`,
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `You're hitting the distinction between *immutable* and *mutable* borrows.

**The Problem**

\`&Vec<String>\` is an *immutable* reference — it gives read-only access. You can look at the data but not change it. To modify the Vec, you need a *mutable* reference: \`&mut Vec<String>\`.

But there's a second issue: the variable \`names\` in \`main\` is declared with \`let\`, not \`let mut\`. In Rust, variables are immutable by default. You can't take a mutable reference to something that isn't declared as mutable.

**The Fix**

Two changes needed:

\`\`\`rust
fn main() {
    let mut names = vec!["Alice".to_string(), "Bob".to_string()];
    //  ^^^ must be 'mut' to allow mutable borrowing

    add_name(&mut names, "Charlie".to_string());
    //       ^^^^ pass a mutable reference

    println!("{:?}", names);
    // Output: ["Alice", "Bob", "Charlie"]
}

fn add_name(names: &mut Vec<String>, name: String) {
    //              ^^^^ accept a mutable reference
    names.push(name);
}
\`\`\`

**Why Rust Makes This Explicit**

In most languages, any function that receives a list can modify it — and you find out at runtime when something unexpected changes your data. In Rust, mutability is tracked in the type system:

- \`&T\` — "I can read this, I promise not to change it"
- \`&mut T\` — "I need to modify this, and I'm the only one who can right now"

This explicitness is verbose, but it means you can look at a function signature and immediately know whether it modifies its arguments. And the compiler guarantees that no one else is reading the data while you're writing to it.

**A Common Pattern: Returning a New Value Instead**

Sometimes instead of mutating in place, a more idiomatic Rust approach is to create and return a new value:

\`\`\`rust
fn with_name(mut names: Vec<String>, name: String) -> Vec<String> {
    names.push(name);
    names  // return ownership of the modified Vec
}

fn main() {
    let names = vec!["Alice".to_string(), "Bob".to_string()];
    let names = with_name(names, "Charlie".to_string());
    //  ^^^^^ shadowing — rebinds 'names' to the new value
    println!("{:?}", names);
}
\`\`\`

Here we take ownership of the Vec (moving it in), modify it, and return it. The caller rebinds the variable using shadowing. This pattern avoids mutable references entirely and can be cleaner in some cases.

**The Mental Model**

Think of it like lending a book:
- \`&T\` = "Here, read my book, but give it back and don't write in it"
- \`&mut T\` = "Here, you can write in my book, but you're the only one borrowing it right now"
- Move = "Here, take my book. It's yours now, I don't have it anymore."

Once this clicks, you'll find that the borrow checker catches real bugs — not just theoretical ones. Data races, iterator invalidation, use-after-free — entire categories of bugs that you'd spend hours debugging in C or C++ just don't exist in safe Rust.`,
        },
      ],
    },
  ],
};
