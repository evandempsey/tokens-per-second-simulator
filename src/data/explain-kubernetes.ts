import type { SampleConversation } from "../types";

export const explainKubernetes: SampleConversation = {
  id: "explain-kubernetes",
  title: "Kubernetes Explained",
  description: "A multi-turn Q&A walking through core Kubernetes concepts",
  category: "chat",
  messages: [
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "I keep hearing about Kubernetes but I don't really understand what it does. Can you explain it from the ground up?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `Kubernetes (often abbreviated K8s) is a system for automating the deployment, scaling, and management of containerized applications. Let me build up from the basics.

**The Problem It Solves**

Imagine you have a web application. In the old days, you'd run it on a single server. If traffic spikes, that server gets overwhelmed. If it crashes, your app goes down. You could buy more servers and set up load balancers, but managing all of that manually is painful — especially when you have dozens or hundreds of services.

Containers (like Docker) solved part of this: they let you package your app with all its dependencies into a portable unit that runs the same everywhere. But containers alone don't solve the orchestration problem: *who decides which server runs which container? What happens when a container crashes? How do you scale up when traffic increases?*

That's what Kubernetes does. It's a **container orchestrator** — you tell it *what* you want running, and it figures out *how* to make that happen across a cluster of machines.

**The Core Mental Model**

Think of Kubernetes as a datacenter operating system. Just like your laptop's OS manages processes, memory, and disk across your CPU cores, Kubernetes manages containers, networking, and storage across a cluster of servers.

You describe your desired state ("I want 3 copies of my web server running, exposed on port 443, with 512MB of RAM each") in a YAML file, and Kubernetes continuously works to make reality match that description. If a container crashes, it restarts it. If a node goes down, it reschedules the containers elsewhere. This is called **declarative configuration** and it's one of the most powerful concepts in K8s.

**The Architecture**

A Kubernetes cluster has two types of machines:

1. **Control Plane** (formerly "master") — runs the brain of the cluster:
   - **API Server**: the front door — everything talks to K8s through this REST API
   - **etcd**: a distributed key-value store that holds all cluster state
   - **Scheduler**: decides which node should run a new container
   - **Controller Manager**: runs control loops that watch the current state and work toward the desired state

2. **Worker Nodes** — the machines that actually run your containers:
   - **kubelet**: an agent on each node that talks to the API server and manages containers
   - **kube-proxy**: handles networking rules so containers can communicate
   - **Container runtime**: usually containerd — actually runs the containers`,
        },
      ],
    },
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "OK that makes sense at a high level. But what are pods? And how are they different from containers?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `Great question — this is one of the things that confuses people early on.

**Pods: The Smallest Deployable Unit**

A Pod is the smallest thing you can create in Kubernetes. It's a wrapper around one or more containers that share the same network namespace and storage volumes.

Most of the time, a Pod runs a single container. So you might wonder: why not just deploy containers directly? The Pod abstraction exists for cases where you need tightly coupled containers that must run together. For example:

- A web server container + a sidecar container that ships its logs to a central system
- An app container + a proxy container (like Envoy) that handles TLS termination
- A main process + an init container that runs setup tasks before the main container starts

Containers within a Pod can communicate via \`localhost\` (they share the same network stack) and can mount the same volumes. They're always scheduled together on the same node.

**But You Almost Never Create Pods Directly**

This is the key insight: you don't typically create Pods by hand. Instead, you create higher-level objects that manage Pods for you:

- **Deployment**: "I want 3 replicas of this Pod running at all times." If one dies, the Deployment controller creates a new one. If you update the container image, it does a rolling update.
- **StatefulSet**: like a Deployment, but for stateful apps (databases, etc.) where each Pod needs a stable identity and persistent storage.
- **DaemonSet**: "Run one copy of this Pod on every node in the cluster." Useful for log collectors, monitoring agents, etc.
- **Job / CronJob**: "Run this Pod once (or on a schedule) and let it complete." Good for batch processing, backups, etc.

**Services: How Pods Talk to Each Other**

Pods are ephemeral — they get IP addresses, but those IPs change every time a Pod is recreated. You can't hardcode them. That's where Services come in.

A Service is a stable network endpoint that routes traffic to a set of Pods. You create a Service that selects Pods by label (e.g., \`app: web-server\`), and Kubernetes gives it a stable DNS name (like \`web-server.default.svc.cluster.local\`) and a cluster IP. Traffic to that IP gets load-balanced across the matching Pods.

There are several types:
- **ClusterIP** (default): only accessible within the cluster
- **NodePort**: exposes the service on a port on every node
- **LoadBalancer**: provisions an external load balancer (on cloud providers)
- **Ingress**: HTTP/HTTPS routing with path-based rules, TLS termination, etc.

So the typical flow is: you create a Deployment (which creates Pods), then a Service (which gives those Pods a stable address), then optionally an Ingress (which exposes them to the internet).`,
        },
      ],
    },
    {
      role: "user",
      segments: [
        {
          type: "text",
          content:
            "How does scaling work? If I get a sudden traffic spike, does Kubernetes automatically add more pods?",
        },
      ],
    },
    {
      role: "assistant",
      segments: [
        {
          type: "text",
          content: `Kubernetes supports both manual and automatic scaling, and it operates at two levels: **Pod scaling** and **Node scaling**.

**Horizontal Pod Autoscaler (HPA)**

This is the most common autoscaling mechanism. You configure an HPA to watch a metric — typically CPU utilization — and it adjusts the number of Pod replicas in a Deployment.

For example: "Keep CPU utilization across my Pods at around 50%. If it goes above that, add more Pods. If it drops below, remove some." You set a min and max replica count to bound the scaling.

\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-server
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
\`\`\`

You can also scale on custom metrics — requests per second, queue depth, whatever you can measure. The HPA checks metrics every 15 seconds by default and adjusts accordingly.

**Vertical Pod Autoscaler (VPA)**

Instead of adding more Pods, VPA adjusts the CPU and memory *requests* of existing Pods. It watches actual resource usage and recommends (or automatically applies) better resource limits. This is useful for workloads that can't scale horizontally (like a single-instance database).

**Cluster Autoscaler (Node Scaling)**

HPA can add Pods, but what if there aren't enough nodes to run them? The Cluster Autoscaler watches for Pods that are "Pending" because no node has enough capacity, and it asks your cloud provider to spin up new VMs. When nodes are underutilized, it drains and removes them.

So the full autoscaling story is:
1. Traffic increases → HPA creates more Pods
2. Not enough node capacity → Cluster Autoscaler adds nodes
3. Traffic decreases → HPA removes Pods
4. Nodes become empty → Cluster Autoscaler removes nodes

This can respond to traffic spikes within a couple of minutes. For even faster scaling, you can use **KEDA** (Kubernetes Event-Driven Autoscaling), which can scale from zero and react to event sources like message queues.

**The Catch: Resource Requests and Limits**

For all of this to work well, you need to set proper resource requests and limits on your Pods:

- **Requests**: the guaranteed minimum resources the Pod needs. The scheduler uses this to decide where to place the Pod.
- **Limits**: the maximum resources the Pod can use. If it exceeds the memory limit, it gets killed (OOMKilled). If it exceeds the CPU limit, it gets throttled.

Getting these right is one of the hardest parts of running Kubernetes in production. Set requests too high and you waste resources. Set them too low and your Pods get evicted under pressure. Tools like VPA and Goldilocks can help you right-size them based on actual usage.`,
        },
      ],
    },
  ],
};
